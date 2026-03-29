import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import type { Connection, Run, SchemaSnapshot } from '../../types'
import { getConnection } from '../../api/connections'
import { getSchema } from '../../api/connections'
import ChatPanel from '../../components/ChatPanel/ChatPanel'
import ResultsPanel from '../../components/ResultsPanel/ResultsPanel'
import './ChatPage.css'

interface LocationState {
  initialQuestion?: string
}

export default function ChatPage() {
  const { connectionId, sessionId } = useParams<{ connectionId: string; sessionId?: string }>()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const [connection, setConnection] = useState<Connection | null>(null)
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null)
  const [selectedRun, setSelectedRun] = useState<Run | null>(null)
  const [activeRun, setActiveRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [resultsLoading, setResultsLoading] = useState(false)

  useEffect(() => {
    if (!connectionId) return
    setLoading(true)
    setSelectedRun(null)
    setActiveRun(null)

    Promise.all([
      getConnection(connectionId),
      getSchema(connectionId),
    ]).then(([conn, schemaData]) => {
      setConnection(conn)
      setSchema(schemaData)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [connectionId])

  function handleRunSelect(run: Run) {
    setSelectedRun(run)
    setResultsLoading(false)
  }

  function handleActiveRunChange(run: Run | null) {
    setActiveRun(run)
    if (run) {
      setResultsLoading(true)
    } else {
      setResultsLoading(false)
    }
  }

  if (!connectionId) return null

  return (
    <div className="chat-page">
      {/* Left panel */}
      <div className="chat-page__left">
        {loading ? (
          <div className="chat-page__loading">
            <div className="chat-page__loading-header">
              <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ height: 16, width: '70%' }} />
                <div className="skeleton" style={{ height: 12, width: '40%' }} />
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="chat-page__loading-spinner">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="var(--border-default)" strokeWidth="3" />
                  <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
                </svg>
              </div>
            </div>
          </div>
        ) : (
          <ChatPanel
            connectionId={connectionId}
            connectionName={connection?.name ?? 'Database'}
            schema={schema}
            sessionId={sessionId}
            onRunSelect={handleRunSelect}
            onActiveRunChange={handleActiveRunChange}
            initialQuestion={locationState?.initialQuestion}
          />
        )}
      </div>

      {/* Right panel */}
      <div className="chat-page__right">
        <ResultsPanel
          run={selectedRun ?? (activeRun?.status === 'done' ? activeRun : null)}
          isLoading={resultsLoading}
          schema={schema?.tables}
        />
      </div>
    </div>
  )
}
