import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Connection } from '../../types'
import { useConnections } from '../../hooks/useConnections'
import { testConnection } from '../../api/connections'
import Badge from '../../components/common/Badge'
import StatusDot from '../../components/common/StatusDot'
import Button from '../../components/common/Button'
import './ConnectionsPage.css'

interface ConnectionsPageProps {
  onConnectionsChange?: (connections: Connection[]) => void
}

function statusVariant(status: Connection['status']): 'success' | 'error' | 'warning' | 'default' {
  switch (status) {
    case 'active': return 'success'
    case 'error': return 'error'
    case 'connecting': return 'warning'
    default: return 'default'
  }
}

function statusLabel(status: Connection['status']): string {
  switch (status) {
    case 'active': return 'Active'
    case 'error': return 'Error'
    case 'connecting': return 'Connecting'
    default: return 'Disconnected'
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function ConnectionCard({ conn, onDelete, onChat }: {
  conn: Connection
  onDelete: (id: string) => void
  onChat: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)

  async function handleTest() {
    setTesting(true)
    setTestMsg(null)
    try {
      const result = await testConnection(conn.id)
      setTestMsg(result.success ? 'Connected ✓' : `Failed: ${result.message}`)
    } catch {
      setTestMsg('Test failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete connection "${conn.name}"? This cannot be undone.`)) return
    setDeleting(true)
    onDelete(conn.id)
  }

  return (
    <div className={`conn-card ${conn.status === 'error' ? 'conn-card--error' : ''}`}>
      {/* Card header */}
      <div className="conn-card__header">
        <div className="conn-card__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
          </svg>
        </div>
        <div className="conn-card__title-group">
          <h3 className="conn-card__name">{conn.name}</h3>
          <Badge variant={statusVariant(conn.status)} size="sm">
            <StatusDot status={conn.status} size="sm" className="conn-card__status-dot" />
            {statusLabel(conn.status)}
          </Badge>
        </div>
      </div>

      {/* Details */}
      <div className="conn-card__details">
        <div className="conn-card__detail">
          <span className="conn-card__detail-label">Host</span>
          <span className="conn-card__detail-value">{conn.host}</span>
        </div>
        <div className="conn-card__detail">
          <span className="conn-card__detail-label">Database</span>
          <span className="conn-card__detail-value conn-card__detail-value--mono">{conn.database}</span>
        </div>
        <div className="conn-card__detail">
          <span className="conn-card__detail-label">Tables</span>
          <span className="conn-card__detail-value">{conn.table_count ?? '—'}</span>
        </div>
        {conn.last_connected_at && (
          <div className="conn-card__detail">
            <span className="conn-card__detail-label">Last connected</span>
            <span className="conn-card__detail-value">{formatDate(conn.last_connected_at)}</span>
          </div>
        )}
        {conn.ssl && (
          <div className="conn-card__detail">
            <span className="conn-card__ssl-badge">SSL</span>
          </div>
        )}
      </div>

      {testMsg && (
        <div className={`conn-card__test-msg ${testMsg.includes('✓') ? 'conn-card__test-msg--ok' : 'conn-card__test-msg--err'}`}>
          {testMsg}
        </div>
      )}

      {/* Actions */}
      <div className="conn-card__actions">
        <Button variant="primary" size="sm" onClick={() => onChat(conn.id)}>
          Open Chat
        </Button>
        <Button variant="ghost" size="sm" loading={testing} onClick={handleTest}>
          Test
        </Button>
        <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="conn-card conn-card--skeleton">
      <div className="conn-card__header">
        <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-sm)' }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton" style={{ height: 18, width: '60%' }} />
          <div className="skeleton" style={{ height: 14, width: '30%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {[80, 60, 40].map(w => (
          <div key={w} className="skeleton" style={{ height: 14, width: `${w}%` }} />
        ))}
      </div>
    </div>
  )
}

export default function ConnectionsPage({ onConnectionsChange }: ConnectionsPageProps) {
  const navigate = useNavigate()
  const { connections, loading, error, deleteConnection } = useConnections()

  async function handleDelete(id: string) {
    await deleteConnection(id)
    if (onConnectionsChange) {
      onConnectionsChange(connections.filter(c => c.id !== id))
    }
  }

  return (
    <div className="connections-page">
      {/* Page header */}
      <div className="connections-page__header">
        <div>
          <h1 className="connections-page__title">Connected Databases</h1>
          <p className="connections-page__subtitle">
            {loading ? 'Loading...' : `${connections.length} connection${connections.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          icon={
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="8" y1="2" x2="8" y2="14" />
              <line x1="2" y1="8" x2="14" y2="8" />
            </svg>
          }
          onClick={() => navigate('/connections/new')}
        >
          Add Connection
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="connections-page__error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="connections-page__grid">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : connections.length === 0 ? (
        <div className="connections-page__empty">
          <div className="connections-page__empty-icon">
            <svg viewBox="0 0 80 80" fill="none">
              <circle cx="40" cy="40" r="36" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="2" />
              <ellipse cx="40" cy="28" rx="16" ry="5" stroke="var(--text-muted)" strokeWidth="2" />
              <path d="M24 28v8c0 2.76 7.16 5 16 5s16-2.24 16-5v-8" stroke="var(--text-muted)" strokeWidth="2" />
              <path d="M24 36v8c0 2.76 7.16 5 16 5s16-2.24 16-5v-8" stroke="var(--text-muted)" strokeWidth="2" />
              <line x1="40" y1="55" x2="40" y2="62" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
              <line x1="36" y1="62" x2="44" y2="62" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h2>No connections yet</h2>
          <p>Connect your first PostgreSQL database to get started</p>
          <Button variant="primary" size="md" onClick={() => navigate('/connections/new')}>
            Add your first connection
          </Button>
        </div>
      ) : (
        <div className="connections-page__grid">
          {connections.map(conn => (
            <ConnectionCard
              key={conn.id}
              conn={conn}
              onDelete={handleDelete}
              onChat={id => navigate(`/chat/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
