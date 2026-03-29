import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/common/Button'
import './LandingPage.css'

function parseConnectionString(cs: string): { host?: string; database?: string; username?: string; password?: string; port?: number } {
  try {
    const match = cs.match(/postgresql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d*)\/([^?]+)/)
    if (!match) return {}
    const [, username, password, host, portStr, database] = match
    return { username, password, host, port: portStr ? parseInt(portStr, 10) : 5432, database }
  } catch {
    return {}
  }
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [connectionString, setConnectionString] = useState('')
  const [loading, setLoading] = useState(false)

  function handleConnect() {
    setLoading(true)
    setTimeout(() => {
      navigate('/connections/new')
    }, 200)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleConnect()
  }

  const parsed = parseConnectionString(connectionString)

  return (
    <div className="landing">
      {/* Background grid */}
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__grid" />
        <div className="landing__glow" />
      </div>

      {/* Nav */}
      <nav className="landing__nav">
        <div className="landing__nav-logo">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
          </svg>
          DataEngineer
        </div>
        <div className="landing__nav-actions">
          <Button variant="ghost" size="sm" onClick={() => navigate('/connections')}>
            Browse connections
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <main className="landing__hero">
        <div className="landing__badge">
          <span className="landing__badge-dot" />
          Powered by AI
        </div>

        <h1 className="landing__title">
          Your data,<br />
          <span className="landing__title-accent">answered.</span>
        </h1>

        <p className="landing__subtitle">
          Connect your PostgreSQL database and ask questions in plain English.
          Get back tables, charts, and spreadsheets instantly.
        </p>

        {/* Quick connect */}
        <div className="landing__connect-box">
          <div className="landing__connect-input-wrap">
            <div className="landing__connect-icon">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
                <ellipse cx="10" cy="4" rx="7" ry="2.5" />
                <path d="M3 4v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V4" />
                <path d="M3 8v4c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V8" />
              </svg>
            </div>
            <input
              type="text"
              className="landing__connect-input"
              value={connectionString}
              onChange={e => setConnectionString(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="postgresql://user:password@host:5432/database"
            />
          </div>

          {connectionString && parsed.database && (
            <div className="landing__parsed">
              <span className="landing__parsed-item">
                <span className="landing__parsed-label">host</span>
                {parsed.host}
              </span>
              <span className="landing__parsed-sep">·</span>
              <span className="landing__parsed-item">
                <span className="landing__parsed-label">db</span>
                {parsed.database}
              </span>
            </div>
          )}

          <div className="landing__connect-actions">
            <Button variant="primary" size="lg" loading={loading} onClick={handleConnect}>
              Connect Database
            </Button>
            <span className="landing__or">or</span>
            <button
              className="landing__manual-link"
              onClick={() => navigate('/connections/new')}
            >
              Use manual setup
            </button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="landing__features">
          <div className="landing__feature">
            <div className="landing__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="9" />
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h3>Smart Schema Understanding</h3>
              <p>Automatically reads your tables, columns, and relationships to provide accurate context to the AI.</p>
            </div>
          </div>

          <div className="landing__feature">
            <div className="landing__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 15h5" strokeLinecap="round" />
                <rect x="3" y="4" width="18" height="16" rx="2" />
              </svg>
            </div>
            <div>
              <h3>Natural Language SQL</h3>
              <p>No SQL knowledge needed. Ask questions like "What were my top products last quarter?" and get instant answers.</p>
            </div>
          </div>

          <div className="landing__feature">
            <div className="landing__feature-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" />
                <polyline points="7 10 12 15 17 10" strokeLinecap="round" />
                <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h3>Export Ready</h3>
              <p>Download results as Excel spreadsheets or export charts as PNG images for presentations and reports.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
