import { useState, useRef, useEffect } from 'react'
import type { Run, Session, SchemaSnapshot } from '../../types'
import { listSessions, getSession } from '../../api/chat'
import { useSuperAgent } from '../../hooks/useSuperAgent'
import MessageBubble from './MessageBubble'
import StepStream from './StepStream'
import QuestionInput from './QuestionInput'
import './ChatPanel.css'

// ── Agent mode sent to super_agent WS event ──────────────────────────────────
// Change this to match your backend CONFIG_MAP key for the data-engineer agent
const AGENT_MODE = 'data_engineer'

interface ChatPanelProps {
  connectionId: string
  connectionName: string
  schema: SchemaSnapshot | null
  sessionId?: string
  onRunSelect?: (run: Run) => void
  onActiveRunChange?: (run: Run | null) => void
  initialQuestion?: string
}

interface Turn {
  /** Temporary client-side ID while the run is in-flight; replaced by runId on done */
  id: string
  question: string
  /** Partial text accumulating during streaming */
  streamingText: string
  /** Final completed run (set when isDone) */
  run: Run | null
  isLoading: boolean
  isStreaming: boolean
}

export default function ChatPanel({
  connectionId,
  connectionName,
  schema,
  sessionId: initialSessionId,
  onRunSelect,
  onActiveRunChange,
  initialQuestion,
}: ChatPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(initialSessionId)
  const [question, setQuestion] = useState(initialQuestion ?? '')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // The active turn being streamed (temp id while in flight)
  const activeTurnIdRef = useRef<string | null>(null)

  const { state: agent, sendMessage } = useSuperAgent()

  // ── Load sessions & optional initial session ──────────────────────────────

  useEffect(() => {
    listSessions(connectionId).then(setSessions).catch(console.error)

    if (initialSessionId) {
      getSession(initialSessionId).then(session => {
        setCurrentSessionId(session.id)
        const loaded: Turn[] = session.runs.map(run => ({
          id: run.id,
          question: run.question,
          streamingText: '',
          run,
          isLoading: false,
          isStreaming: false,
        }))
        setTurns(loaded)
        if (session.runs.length > 0) {
          onRunSelect?.(session.runs[session.runs.length - 1])
        }
      }).catch(console.error)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, initialSessionId])

  // ── Mirror streaming token text into the active turn ─────────────────────

  useEffect(() => {
    const tid = activeTurnIdRef.current
    if (!tid || !agent.isRunning) return
    setTurns(prev => prev.map(t =>
      t.id === tid ? { ...t, streamingText: agent.tokenText, isStreaming: true } : t
    ))
  }, [agent.tokenText, agent.isRunning])

  // ── Handle run completion ─────────────────────────────────────────────────

  useEffect(() => {
    const tid = activeTurnIdRef.current
    if (!agent.isDone || !tid) return

    const finalRun: Run = {
      id: agent.runId ?? tid,
      session_id: currentSessionId ?? '',
      question: turns.find(t => t.id === tid)?.question ?? '',
      answer_text: agent.tokenText,
      queries_executed: [],
      status: agent.error ? 'error' : 'done',
      error_message: agent.error ?? undefined,
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }

    setTurns(prev => prev.map(t =>
      t.id === tid
        ? { ...t, id: finalRun.id, run: finalRun, isLoading: false, isStreaming: false }
        : t
    ))

    activeTurnIdRef.current = null
    onRunSelect?.(finalRun)
    onActiveRunChange?.(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.isDone])

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, agent.tokenText])

  // ── Submit handler ────────────────────────────────────────────────────────

  function handleSubmit() {
    if (!question.trim() || agent.isRunning) return
    const q = question.trim()
    setQuestion('')

    // Create/reuse a session id for this conversation
    const sessionId = currentSessionId ?? crypto.randomUUID()
    if (!currentSessionId) {
      setCurrentSessionId(sessionId)
    }

    const tempId = `temp-${Date.now()}`
    activeTurnIdRef.current = tempId

    const newTurn: Turn = {
      id: tempId,
      question: q,
      streamingText: '',
      run: null,
      isLoading: true,
      isStreaming: false,
    }
    setTurns(prev => [...prev, newTurn])

    // Notify parent that a run is starting
    onActiveRunChange?.({
      id: tempId,
      session_id: sessionId,
      question: q,
      answer_text: '',
      queries_executed: [],
      status: 'running',
      created_at: new Date().toISOString(),
    })

    // Emit via socket
    sendMessage(AGENT_MODE, sessionId, q, { connection_id: connectionId })
  }

  function handleSuggestedQuestion(q: string) {
    setQuestion(q)
  }

  // ── Convert timeline steps to the AgentStep format StepStream expects ─────

  const agentSteps = agent.steps.map(s => ({
    type: 'planning' as const,
    message: s.text,
    timestamp: '',
  }))

  const tableCount = schema?.tables.length ?? 0
  const suggestedQuestions = schema?.suggested_questions ?? []
  const isEmpty = turns.length === 0

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-panel__header">
        <div className="chat-panel__header-info">
          <div className="chat-panel__db-icon">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <ellipse cx="10" cy="4" rx="7" ry="2.5" />
              <path d="M3 4v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V4" />
              <path d="M3 8v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V8" />
            </svg>
          </div>
          <div>
            <h2 className="chat-panel__conn-name">{connectionName}</h2>
            <span className="chat-panel__conn-meta">{tableCount} tables</span>
          </div>
        </div>

        {/* Connection status dot */}
        <div
          className={`chat-panel__ws-dot ${agent.isConnected ? 'chat-panel__ws-dot--connected' : ''}`}
          title={agent.isConnected ? 'Live connection' : 'Not connected'}
        />

        {sessions.length > 0 && (
          <div className="chat-panel__session-count">
            <span>{sessions.length} sessions</span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="chat-panel__messages">
        {isEmpty ? (
          <div className="chat-panel__empty">
            <div className="chat-panel__empty-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="var(--accent-muted)" />
                <ellipse cx="24" cy="12" rx="12" ry="4" stroke="var(--accent)" strokeWidth="2" />
                <path d="M12 12v6c0 2.21 5.37 4 12 4s12-1.79 12-4v-6" stroke="var(--accent)" strokeWidth="2" />
                <path d="M12 18v6c0 2.21 5.37 4 12 4s12-1.79 12-4v-6" stroke="var(--accent)" strokeWidth="2" />
                <path d="M12 24v6c0 2.21 5.37 4 12 4s12-1.79 12-4v-6" stroke="var(--accent)" strokeWidth="2" />
              </svg>
            </div>
            <h3>Ask about your data</h3>
            <p>Ask any question in plain English and get back tables, charts, and insights.</p>
            {suggestedQuestions.length > 0 && (
              <div className="chat-panel__suggestions">
                <p className="chat-panel__suggestions-label">Suggested questions:</p>
                <div className="chat-panel__suggestion-chips">
                  {suggestedQuestions.slice(0, 4).map(q => (
                    <button
                      key={q}
                      className="chat-panel__suggestion-chip"
                      onClick={() => handleSuggestedQuestion(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="chat-panel__turns">
            {turns.map((turn, i) => {
              const isActiveTurn = i === turns.length - 1 && (turn.isLoading || turn.isStreaming)
              return (
                <div key={turn.id} className="chat-panel__turn">
                  {/* User question */}
                  <MessageBubble
                    role="user"
                    content={turn.question}
                    timestamp={turn.run?.created_at}
                  />

                  {/* Timeline steps while the agent is working */}
                  {isActiveTurn && agentSteps.length > 0 && !agent.tokenText && (
                    <StepStream steps={agentSteps} isActive={agent.isRunning} />
                  )}

                  {/* Streaming text as it arrives */}
                  {isActiveTurn && turn.streamingText && (
                    <MessageBubble
                      role="assistant"
                      content={turn.streamingText}
                      isStreaming
                    />
                  )}

                  {/* Initial loading bubble (before first token) */}
                  {isActiveTurn && !turn.streamingText && agentSteps.length === 0 && (
                    <MessageBubble role="assistant" content="" isLoading />
                  )}

                  {/* Completed assistant response */}
                  {!isActiveTurn && turn.run?.status === 'done' && (
                    <MessageBubble
                      role="assistant"
                      content={turn.run.answer_text}
                      timestamp={turn.run.completed_at}
                    />
                  )}

                  {/* Error state */}
                  {!isActiveTurn && turn.run?.status === 'error' && (
                    <MessageBubble
                      role="assistant"
                      content={turn.run.error_message ?? turn.run.answer_text ?? 'An error occurred.'}
                      timestamp={turn.run.created_at}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Inline suggested questions after first turn */}
      {!isEmpty && suggestedQuestions.length > 0 && turns.length < 2 && (
        <div className="chat-panel__inline-suggestions">
          {suggestedQuestions.slice(0, 3).map(q => (
            <button
              key={q}
              className="chat-panel__suggestion-chip"
              onClick={() => handleSuggestedQuestion(q)}
              disabled={agent.isRunning}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-panel__input-area">
        <QuestionInput
          value={question}
          onChange={setQuestion}
          onSubmit={handleSubmit}
          disabled={agent.isRunning}
        />
      </div>
    </div>
  )
}
