import { useState, useRef, useEffect } from 'react'
import type { Run, Session, SchemaSnapshot } from '../../types'
import { listSessions, getSession, askQuestion, completeRun } from '../../api/chat'
import { useWebSocket } from '../../hooks/useWebSocket'
import MessageBubble from './MessageBubble'
import StepStream from './StepStream'
import QuestionInput from './QuestionInput'
import './ChatPanel.css'

interface ChatPanelProps {
  connectionId: string
  connectionName: string
  schema: SchemaSnapshot | null
  sessionId?: string
  onRunSelect: (run: Run) => void
  onActiveRunChange: (run: Run | null) => void
  initialQuestion?: string
}

interface Turn {
  id: string
  question: string
  run: Run | null
  isLoading: boolean
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
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { steps, isComplete } = useWebSocket(activeRunId)

  // Load initial session
  useEffect(() => {
    listSessions(connectionId).then(setSessions).catch(console.error)

    if (initialSessionId) {
      getSession(initialSessionId).then(session => {
        setCurrentSessionId(session.id)
        const newTurns: Turn[] = session.runs.map(run => ({
          id: run.id,
          question: run.question,
          run,
          isLoading: false,
        }))
        setTurns(newTurns)
        if (session.runs.length > 0) {
          const lastRun = session.runs[session.runs.length - 1]
          onRunSelect(lastRun)
        }
      }).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, initialSessionId])

  // When run completes via websocket
  useEffect(() => {
    if (isComplete && activeRunId && currentSessionId) {
      const sessionId = currentSessionId
      const runId = activeRunId
      completeRun(runId, sessionId).then(completedRun => {
        setTurns(prev => prev.map(t =>
          t.id === runId ? { ...t, run: completedRun, isLoading: false } : t
        ))
        setIsRunning(false)
        setActiveRunId(null)
        onRunSelect(completedRun)
        onActiveRunChange(null)
      }).catch(console.error)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, activeRunId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, steps])

  async function handleSubmit() {
    if (!question.trim() || isRunning) return
    const q = question.trim()
    setQuestion('')
    setIsRunning(true)

    const tempId = `temp-${Date.now()}`
    const newTurn: Turn = {
      id: tempId,
      question: q,
      run: null,
      isLoading: true,
    }
    setTurns(prev => [...prev, newTurn])

    try {
      const run = await askQuestion(connectionId, q, currentSessionId)
      if (!currentSessionId) {
        setCurrentSessionId(run.session_id)
        // Reload sessions
        listSessions(connectionId).then(setSessions).catch(console.error)
      }
      setTurns(prev => prev.map(t =>
        t.id === tempId ? { ...t, id: run.id, run, isLoading: true } : t
      ))
      setActiveRunId(run.id)
      onActiveRunChange(run)
    } catch (err) {
      setTurns(prev => prev.map(t =>
        t.id === tempId
          ? { ...t, isLoading: false, run: { id: tempId, session_id: '', question: q, answer_text: 'Error: ' + String(err), queries_executed: [], status: 'error', created_at: new Date().toISOString() } }
          : t
      ))
      setIsRunning(false)
    }
  }

  function handleSuggestedQuestion(q: string) {
    setQuestion(q)
  }

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
            <p>
              Ask any question in plain English and get back tables, charts, and insights.
            </p>
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
            {turns.map((turn, i) => (
              <div key={turn.id} className="chat-panel__turn">
                {/* User question */}
                <MessageBubble
                  role="user"
                  content={turn.question}
                  timestamp={turn.run?.created_at}
                />

                {/* Agent steps while loading */}
                {turn.isLoading && i === turns.length - 1 && (
                  <StepStream steps={steps} isActive={isRunning} />
                )}

                {/* Assistant response */}
                {turn.run?.status === 'done' && (
                  <div>
                    <MessageBubble
                      role="assistant"
                      content={turn.run.answer_text}
                      timestamp={turn.run.completed_at}
                    />
                    <button
                      className="chat-panel__view-results"
                      onClick={() => turn.run && onRunSelect(turn.run)}
                    >
                      View table & chart →
                    </button>
                  </div>
                )}

                {/* Error state */}
                {turn.run?.status === 'error' && (
                  <MessageBubble
                    role="assistant"
                    content={turn.run.error_message ?? turn.run.answer_text ?? 'An error occurred.'}
                    timestamp={turn.run.created_at}
                  />
                )}

                {/* Loading bubble */}
                {turn.isLoading && steps.length === 0 && (
                  <MessageBubble role="assistant" content="" isLoading />
                )}
              </div>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions if no turns */}
      {!isEmpty && suggestedQuestions.length > 0 && turns.length < 2 && (
        <div className="chat-panel__inline-suggestions">
          {suggestedQuestions.slice(0, 3).map(q => (
            <button
              key={q}
              className="chat-panel__suggestion-chip"
              onClick={() => handleSuggestedQuestion(q)}
              disabled={isRunning}
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
          disabled={isRunning}
        />
      </div>
    </div>
  )
}
