import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Session } from '../../types'
import { listSessions, getSession } from '../../api/chat'
import type { Run } from '../../types'
import Badge from '../../components/common/Badge'
import './HistoryPage.css'

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function groupByConnection(sessions: Session[]): Record<string, { name: string; sessions: Session[] }> {
  const groups: Record<string, { name: string; sessions: Session[] }> = {}
  for (const session of sessions) {
    if (!groups[session.connection_id]) {
      groups[session.connection_id] = { name: session.connection_name, sessions: [] }
    }
    groups[session.connection_id].sessions.push(session)
  }
  return groups
}

function SessionRow({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])
  const [loadingRuns, setLoadingRuns] = useState(false)
  const navigate = useNavigate()

  async function handleExpand() {
    if (!expanded && runs.length === 0) {
      setLoadingRuns(true)
      try {
        const data = await getSession(session.id)
        setRuns(data.runs)
      } catch {
        // ignore
      } finally {
        setLoadingRuns(false)
      }
    }
    setExpanded(e => !e)
  }

  return (
    <div className={`history-session ${expanded ? 'history-session--expanded' : ''}`}>
      <button className="history-session__header" onClick={handleExpand}>
        <div className="history-session__header-left">
          <span className={`history-session__chevron ${expanded ? 'history-session__chevron--open' : ''}`}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="4 6 8 10 12 6" />
            </svg>
          </span>
          <div className="history-session__info">
            <span className="history-session__title">{session.title}</span>
            <div className="history-session__meta">
              <span className="history-session__date">{formatDate(session.last_active_at)}</span>
              <span className="history-session__sep">·</span>
              <span className="history-session__runs">{session.run_count} queries</span>
            </div>
          </div>
        </div>
        <button
          className="history-session__open-btn"
          onClick={e => { e.stopPropagation(); navigate(`/chat/${session.connection_id}/${session.id}`) }}
        >
          Open →
        </button>
      </button>

      {expanded && (
        <div className="history-session__runs-list">
          {loadingRuns ? (
            <div className="history-session__loading">
              {[1, 2].map(i => (
                <div key={i} className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-sm)' }} />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="history-session__empty">No queries in this session</p>
          ) : (
            runs.map(run => (
              <div key={run.id} className="history-run">
                <div className="history-run__question">
                  <span className="history-run__q-icon">Q</span>
                  {run.question}
                </div>
                {run.answer_text && (
                  <p className="history-run__answer">
                    {run.answer_text.slice(0, 160)}{run.answer_text.length > 160 ? '...' : ''}
                  </p>
                )}
                <div className="history-run__footer">
                  <span className="history-run__time">{formatDate(run.created_at)}</span>
                  {run.table_data && (
                    <Badge variant="info" size="sm">{run.table_data.rows.length} rows</Badge>
                  )}
                  {run.chart_spec && (
                    <Badge variant="default" size="sm">{run.chart_spec.type} chart</Badge>
                  )}
                  <Badge
                    variant={run.status === 'done' ? 'success' : run.status === 'error' ? 'error' : 'warning'}
                    size="sm"
                  >
                    {run.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    listSessions().then(data => {
      setSessions(data)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
  }, [])

  const filtered = sessions.filter(s =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    s.connection_name.toLowerCase().includes(search.toLowerCase())
  )

  const groups = groupByConnection(filtered)

  return (
    <div className="history-page">
      {/* Header */}
      <div className="history-page__header">
        <div>
          <h1 className="history-page__title">Query History</h1>
          <p className="history-page__subtitle">All past sessions across your connections</p>
        </div>
      </div>

      {/* Search */}
      <div className="history-page__search-wrap">
        <div className="history-page__search">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5" />
            <line x1="11" y1="11" x2="14" y2="14" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="history-page__search-input"
          />
          {search && (
            <button className="history-page__search-clear" onClick={() => setSearch('')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="history-page__content">
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[1, 2, 3].map(i => (
              <div key={i}>
                <div className="skeleton" style={{ height: 20, width: 160, marginBottom: 8 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[1, 2].map(j => (
                    <div key={j} className="skeleton" style={{ height: 64, borderRadius: 'var(--radius-md)' }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="history-page__empty">
            <div className="history-page__empty-icon">
              <svg viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="22" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="1.5" />
                <circle cx="24" cy="22" r="8" stroke="var(--text-muted)" strokeWidth="2" />
                <line x1="24" y1="18" x2="24" y2="22" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                <line x1="24" y1="22" x2="27" y2="24" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p>{search ? `No sessions matching "${search}"` : 'No query history yet'}</p>
            <span>Your query sessions will appear here</span>
          </div>
        ) : (
          Object.entries(groups).map(([connId, group]) => (
            <div key={connId} className="history-group">
              <div className="history-group__header">
                <div className="history-group__icon">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <ellipse cx="8" cy="4" rx="6" ry="2" />
                    <path d="M2 4v3c0 1.1 2.69 2 6 2s6-.9 6-2V4" />
                    <path d="M2 7v3c0 1.1 2.69 2 6 2s6-.9 6-2V7" />
                  </svg>
                </div>
                <h2 className="history-group__name">{group.name}</h2>
                <span className="history-group__count">{group.sessions.length} sessions</span>
              </div>
              <div className="history-group__sessions">
                {group.sessions.map(session => (
                  <SessionRow key={session.id} session={session} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
