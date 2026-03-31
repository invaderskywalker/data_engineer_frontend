import { useState, useEffect, useCallback, useRef } from 'react'
import { getSocket, onSocketReplaced, isSocketFailed } from '../lib/socket'
import type { Socket } from 'socket.io-client'

// ── Types matching backend WS events ────────────────────────────────────────

export interface TimelineStep {
  key: string
  text: string
  is_completed: boolean
}

export interface SuperAgentState {
  isConnected: boolean
  isRunning: boolean
  runId: string | null
  /** Accumulated streaming text from assistant_token events */
  tokenText: string
  /** Progress steps from agentic_timeline events */
  steps: TimelineStep[]
  isDone: boolean
  error: string | null
}

const INITIAL_STATE: SuperAgentState = {
  isConnected: false,
  isRunning: false,
  runId: null,
  tokenText: '',
  steps: [],
  isDone: false,
  error: null,
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useSuperAgent() {
  const [state, setState] = useState<SuperAgentState>(INITIAL_STATE)

  // Always holds the cleanup fn for the currently-active run's listeners.
  const cleanupRef = useRef<(() => void) | null>(null)
  // Always holds the current socket — updated when forceReconnect() replaces it.
  const socketRef = useRef<Socket>(getSocket())

  // ── Register connect / disconnect listeners ───────────────────────────────

  function attachConnectionListeners(socket: Socket) {
    const onConnect = () => setState(s => ({ ...s, isConnected: true }))

    const onDisconnect = (reason: string) => {
      // If a run was active when the socket dropped, abort it so the UI
      // doesn't hang in an infinite loading state.
      const activeCleanup = cleanupRef.current
      if (activeCleanup) {
        activeCleanup()
        setState(s => ({
          ...s,
          isConnected: false,
          isRunning: false,
          isDone: true,
          error: reason === 'io server disconnect'
            ? 'Server closed the connection.'
            : 'Connection lost. Please try again.',
        }))
      } else {
        setState(s => ({ ...s, isConnected: false }))
      }
    }

    const onReconnectFailed = () => {
      const activeCleanup = cleanupRef.current
      if (activeCleanup) {
        activeCleanup()
        setState(s => ({
          ...s,
          isConnected: false,
          isRunning: false,
          isDone: true,
          error: 'Could not reconnect to the server. Please refresh the page.',
        }))
      } else {
        setState(s => ({ ...s, isConnected: false }))
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.io.on('reconnect_failed', onReconnectFailed)

    // Sync immediately with current state
    setState(s => ({ ...s, isConnected: socket.connected }))

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.io.off('reconnect_failed', onReconnectFailed)
    }
  }

  useEffect(() => {
    const socket = socketRef.current
    const detach = attachConnectionListeners(socket)

    // When forceReconnect() creates a new socket instance, re-attach listeners.
    const unsubReplace = onSocketReplaced((newSocket) => {
      detach()
      socketRef.current = newSocket
      attachConnectionListeners(newSocket)
    })

    return () => {
      detach()
      unsubReplace()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── sendMessage ───────────────────────────────────────────────────────────

  /**
   * Emit the super_agent event and wire up all response listeners for this run.
   * Automatically tears down listeners from any previous unfinished run.
   */
  const sendMessage = useCallback((
    mode: string,
    sessionId: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void => {
    // Tear down listeners from any previous run
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }

    // If the socket gave up reconnecting, bail out immediately
    if (isSocketFailed()) {
      setState(s => ({
        ...s,
        isRunning: false,
        isDone: true,
        error: 'Not connected. Please refresh the page.',
      }))
      return
    }

    const socket = socketRef.current

    // Reset to a fresh running state
    setState({
      isConnected: socket.connected,
      isRunning: true,
      runId: null,
      tokenText: '',
      steps: [],
      isDone: false,
      error: null,
    })

    // ── Event handlers ───────────────────────────────────────────────────────

    // Backend: {"run_id": "..."}
    const onProcessStart = (data: { run_id: string }) => {
      setState(s => ({ ...s, runId: data.run_id }))
    }

    // Backend: {"token": "<chunk>"}
    const onToken = (data: { token: string }) => {
      setState(s => ({ ...s, tokenText: s.tokenText + (data.token ?? '') }))
    }

    // Backend: {"event": "timeline", "data": {key, text, is_completed}, ...}
    const onTimeline = (data: {
      event: string
      data?: { key: string; text: string; is_completed: boolean }
    }) => {
      if (data.event !== 'timeline' || !data.data) return
      const step: TimelineStep = {
        key: data.data.key,
        text: data.data.text,
        is_completed: data.data.is_completed,
      }
      setState(s => {
        const idx = s.steps.findIndex(st => st.key === step.key)
        if (idx >= 0) {
          const steps = [...s.steps]
          steps[idx] = step
          return { ...s, steps }
        }
        return { ...s, steps: [...s.steps, step] }
      })
    }

    // Backend: {"run_id": "..."} — agent finished successfully
    const onEnd = (_data: { run_id: string }) => {
      setState(s => ({ ...s, isRunning: false, isDone: true }))
      cleanup()
    }

    // Backend error: {"status": "error", "error": "..."} or the string "failed"
    const onGeneralAgentV2 = (data: { status?: string; error?: string } | string) => {
      const msg = typeof data === 'string'
        ? data
        : (data.error ?? data.status ?? 'Unknown error')
      setState(s => ({ ...s, isRunning: false, isDone: true, error: msg }))
      cleanup()
    }

    // ── Register ─────────────────────────────────────────────────────────────

    socket.on('assistant_process_start', onProcessStart)
    socket.on('assistant_token', onToken)
    socket.on('agentic_timeline', onTimeline)
    socket.on('assistant_end', onEnd)
    socket.on('general_agent_v2', onGeneralAgentV2)

    function cleanup() {
      socket.off('assistant_process_start', onProcessStart)
      socket.off('assistant_token', onToken)
      socket.off('agentic_timeline', onTimeline)
      socket.off('assistant_end', onEnd)
      socket.off('general_agent_v2', onGeneralAgentV2)
      cleanupRef.current = null
    }

    cleanupRef.current = cleanup

    // ── Emit ─────────────────────────────────────────────────────────────────

    socket.emit('super_agent', {
      mode,
      session_id: sessionId,
      message,
      metadata: metadata ?? null,
    })
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return { state, sendMessage }
}
