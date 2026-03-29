import { useState, useEffect, useRef } from 'react'
import type { AgentStep } from '../types'
import { IS_MOCK } from '../api/client'

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
  const socketRef = useRef<{ disconnect: () => void } | null>(null)

  useEffect(() => {
    if (!runId) {
      setSteps([])
      setIsConnected(false)
      setIsComplete(false)
      return
    }

    // Clear any existing state
    setSteps([])
    setIsComplete(false)

    if (IS_MOCK) {
      // Simulate streaming steps with delays
      setIsConnected(true)
      let delay = 400

      mockTimersRef.current.forEach(t => clearTimeout(t))
      mockTimersRef.current = []

      MOCK_STEPS.forEach((step, index) => {
        const timer = setTimeout(() => {
          const stepWithTimestamp: AgentStep = {
            ...step,
            timestamp: new Date().toISOString(),
          }
          setSteps(prev => [...prev, stepWithTimestamp])

          if (index === MOCK_STEPS.length - 1) {
            setIsComplete(true)
            setIsConnected(false)
          }
        }, delay)

        mockTimersRef.current.push(timer)
        delay += Math.floor(Math.random() * 600) + 500
      })

      return () => {
        mockTimersRef.current.forEach(t => clearTimeout(t))
        mockTimersRef.current = []
      }
    }

    // Real socket.io connection
    const connectSocket = async () => {
      const { io } = await import('socket.io-client')
      const socket = io('http://localhost:5000', {
        query: { run_id: runId },
        transports: ['websocket'],
      })

      socketRef.current = socket

      socket.on('connect', () => {
        setIsConnected(true)
      })

      socket.on('disconnect', () => {
        setIsConnected(false)
      })

      socket.on('agent_step', (step: AgentStep) => {
        setSteps(prev => [...prev, step])
        if (step.type === 'done' || step.type === 'error') {
          setIsComplete(true)
          socket.disconnect()
        }
      })

      socket.on('error', () => {
        setIsConnected(false)
      })
    }

    connectSocket()

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [runId])

  return { steps, isConnected, isComplete }
}
