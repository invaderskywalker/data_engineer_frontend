import { NavLink, useNavigate } from 'react-router-dom'
import type { Connection } from '../../types'
import StatusDot from '../common/StatusDot'
import './Sidebar.css'

interface SidebarProps {
  connections: Connection[]
  collapsed: boolean
  onCollapse: () => void
  loading?: boolean
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
      <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
      <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
    </svg>
  )
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function ChevronIcon({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: direction === 'right' ? 'rotate(180deg)' : undefined }}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function ConnectionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}

export default function Sidebar({ connections, collapsed, onCollapse, loading }: SidebarProps) {
  const navigate = useNavigate()

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Logo area */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">
          <DatabaseIcon />
        </div>
        {!collapsed && (
          <span className="sidebar__logo-text">DataEngineer</span>
        )}
        <button
          className="sidebar__collapse-btn"
          onClick={onCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronIcon direction={collapsed ? 'right' : 'left'} />
        </button>
      </div>

      {/* Connections section */}
      <div className="sidebar__section">
        {!collapsed && (
          <div className="sidebar__section-header">
            <span className="sidebar__section-label">Connections</span>
            <button
              className="sidebar__add-btn"
              onClick={() => navigate('/connections/new')}
              title="Add connection"
            >
              <PlusIcon />
            </button>
          </div>
        )}

        {collapsed && (
          <button
            className="sidebar__add-btn sidebar__add-btn--standalone"
            onClick={() => navigate('/connections/new')}
            title="Add connection"
          >
            <PlusIcon />
          </button>
        )}

        <nav className="sidebar__connections">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="sidebar__conn-skeleton skeleton" />
            ))
          ) : connections.length === 0 ? (
            !collapsed && (
              <div className="sidebar__empty">
                <span>No connections</span>
              </div>
            )
          ) : (
            connections.map(conn => (
              <NavLink
                key={conn.id}
                to={`/chat/${conn.id}`}
                className={({ isActive }) =>
                  `sidebar__conn-item ${isActive ? 'sidebar__conn-item--active' : ''}`
                }
                title={collapsed ? conn.name : undefined}
              >
                <StatusDot status={conn.status} size="sm" />
                {!collapsed && (
                  <>
                    <span className="sidebar__conn-name">{conn.name}</span>
                    <span className="sidebar__conn-tables">
                      {conn.table_count ?? 0}t
                    </span>
                  </>
                )}
              </NavLink>
            ))
          )}
        </nav>
      </div>

      {/* Bottom nav */}
      <div className="sidebar__bottom">
        <NavLink
          to="/connections"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={collapsed ? 'All Connections' : undefined}
        >
          <span className="sidebar__nav-icon"><ConnectionsIcon /></span>
          {!collapsed && <span>All Connections</span>}
        </NavLink>

        <NavLink
          to="/history"
          className={({ isActive }) =>
            `sidebar__nav-item ${isActive ? 'sidebar__nav-item--active' : ''}`
          }
          title={collapsed ? 'History' : undefined}
        >
          <span className="sidebar__nav-icon"><HistoryIcon /></span>
          {!collapsed && <span>History</span>}
        </NavLink>
      </div>
    </aside>
  )
}
