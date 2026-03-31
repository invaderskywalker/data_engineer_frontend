import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import type { Connection, Run, SchemaSnapshot } from '../../types'
import { getConnection, getSchema } from '../../api/connections'
import ChatPanel from '../../components/ChatPanel/ChatPanel'
import SchemaFlow from '../../components/SchemaFlow/SchemaFlow'
import ArtifactsPanel from '../../components/ArtifactsPanel/ArtifactsPanel'
import './ChatPage.css'

interface LocationState {
  initialQuestion?: string
}

type ViewMode = 'configure' | 'query'

export default function ChatPage() {
  const { connectionId, sessionId } = useParams<{ connectionId: string; sessionId?: string }>()
  const location = useLocation()
  const locationState = location.state as LocationState | null

  const [connection, setConnection] = useState<Connection | null>(null)
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('configure')
  const [activeRun, setActiveRun] = useState<Run | null>(null)

  useEffect(() => {
    if (!connectionId) return
    setLoading(true)
    setActiveRun(null)

    Promise.all([
      getConnection(connectionId),
      getSchema(connectionId),
    ]).then(([conn, schemaData]) => {
      setConnection(conn)
      setSchema(schemaData)
      // Auto-select view: config exists → query, else → configure
      setViewMode(schemaData && schemaData.tables.length > 0 ? 'query' : 'configure')
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [connectionId])

  if (!connectionId) return null

  const configBuilt = schema !== null && schema.tables.length > 0

  return (
    <div className="chat-page">

      {/* ── Top toggle bar ──────────────────────────── */}
      <div className="chat-page__topbar">
        <div className="chat-page__view-toggle">
          <button
            className={`chat-page__view-btn ${viewMode === 'configure' ? 'chat-page__view-btn--active' : ''}`}
            onClick={() => setViewMode('configure')}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="2" />
              <path d="M7 1.5v1M7 11.5v1M1.5 7h1M11.5 7h1M3.4 3.4l.7.7M9.9 9.9l.7.7M10.6 3.4l-.7.7M4.1 9.9l-.7.7" strokeLinecap="round" />
            </svg>
            Configure
            {!configBuilt && <span className="chat-page__needs-setup">•</span>}
          </button>
          <button
            className={`chat-page__view-btn ${viewMode === 'query' ? 'chat-page__view-btn--active' : ''}`}
            onClick={() => setViewMode('query')}
            disabled={!configBuilt}
            title={!configBuilt ? 'Build config first' : undefined}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="5.5" cy="5.5" r="4" />
              <line x1="8.7" y1="8.7" x2="12.5" y2="12.5" strokeLinecap="round" />
            </svg>
            Query
          </button>
        </div>

        {connection && (
          <span className="chat-page__conn-label">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <ellipse cx="6" cy="3" rx="4.5" ry="1.8" />
              <path d="M1.5 3v2.5c0 1 2.01 1.8 4.5 1.8s4.5-.8 4.5-1.8V3" />
              <path d="M1.5 5.5V8c0 1 2.01 1.8 4.5 1.8S10.5 9 10.5 8V5.5" />
            </svg>
            {connection.name}
          </span>
        )}
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className="chat-page__body">
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
        ) : viewMode === 'configure' ? (

          /* ── Configure: schema overview + chat ──────── */
          <div className="chat-page__configure">
            <div className="chat-page__configure-schema">
              <SchemaFlow schema={schema} defaultTab="overview" />
            </div>
            <div className="chat-page__configure-chat">
              <ChatPanel
                connectionId={connectionId}
                connectionName={connection?.name ?? 'Database'}
                schema={schema}
                sessionId={sessionId}
                initialQuestion={locationState?.initialQuestion}
                onRunSelect={run => setActiveRun(run)}
                onActiveRunChange={run => { if (run) setActiveRun(run) }}
              />
            </div>
          </div>

        ) : (

          /* ── Query: chat (left) + artifacts (right) ─ */
          <div className="chat-page__query-layout">
            <div className="chat-page__chat">
              <ChatPanel
                connectionId={connectionId}
                connectionName={connection?.name ?? 'Database'}
                schema={schema}
                sessionId={sessionId}
                initialQuestion={locationState?.initialQuestion}
                onRunSelect={run => setActiveRun(run)}
                onActiveRunChange={run => { if (run) setActiveRun(run) }}
              />
            </div>
            <div className="chat-page__artifacts">
              <ArtifactsPanel run={activeRun} />
            </div>
          </div>

        )}
      </div>

    </div>
  )
}
