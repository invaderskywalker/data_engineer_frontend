import { useState, useEffect, useRef } from 'react'
import type { AgentStep } from '../types'
import { IS_MOCK, delay } from '../api/client'
import { getSocket } from '../lib/socket'

const MOCK_STEPS: AgentStep[] = [
  {
    type: 'planning',
    message: 'Analyzing question and determining the best approach...',
    timestamp: '',
  },
  {
    type: 'sql_generated',
    message: 'Generated SQL query to answer your question',
    sql: `SELECT p.category, SUM(oi.price * oi.quantity) AS revenue\nFROM orders o\nJOIN order_items oi ON o.id = oi.order_id\nJOIN products p ON oi.product_id = p.id\nWHERE o.created_at >= DATE_TRUNC('month', NOW())\nGROUP BY p.category\nORDER BY revenue DESC`,
    timestamp: '',
  },
  {
    type: 'executing',
    message: 'Executing query against your database...',
    timestamp: '',
  },
  {
    type: 'formatting',
    message: 'Processing results and generating visualizations...',
    timestamp: '',
  },
  {
    type: 'done',
    message: 'Analysis complete',
    timestamp: '',
  },
]

interface UseWebSocketResult {
  steps: AgentStep[]
  isConnected: boolean
  isComplete: boolean
}

export function useWebSocket(runId: string | null): UseWebSocketResult {
  const [steps, setSteps] = useState<AgentStep[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const mockTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  // Holds the per-event-listener teardown for the current runId subscription
  const unsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!runId) {
      setSteps([])
      setIsConnected(false)
      setIsComplete(false)
      return
    }

    // Clear any existing state / subscriptions from the previous runId
    setSteps([])
    setIsComplete(false)
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }

    if (IS_MOCK) {
      setIsConnected(true)
      let d = 400

      mockTimersRef.current.forEach(t => clearTimeout(t))
      mockTimersRef.current = []

      MOCK_STEPS.forEach((step, index) => {
        const timer = setTimeout(() => {
          setSteps(prev => [...prev, { ...step, timestamp: new Date().toISOString() }])
          if (index === MOCK_STEPS.length - 1) {
            setIsComplete(true)
            setIsConnected(false)
          }
        }, d)

        mockTimersRef.current.push(timer)
        d += Math.floor(Math.random() * 600) + 500
      })

      // suppress unused-import warning for delay
      void delay

      return () => {
        mockTimersRef.current.forEach(t => clearTimeout(t))
        mockTimersRef.current = []
      }
    }

    // Use the shared singleton so we don't open a second WebSocket connection
    const socket = getSocket()

    setIsConnected(socket.connected)

    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)

    const onAgentStep = (step: AgentStep) => {
      setSteps(prev => [...prev, step])
      if (step.type === 'done' || step.type === 'error') {
        setIsComplete(true)
        if (unsubRef.current) {
          unsubRef.current()
          unsubRef.current = null
        }
      }
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('agent_step', onAgentStep)

    unsubRef.current = () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('agent_step', onAgentStep)
    }

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [runId])

  return { steps, isConnected, isComplete }
}
