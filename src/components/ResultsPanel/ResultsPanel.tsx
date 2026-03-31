import { useState } from 'react'
import type { Run } from '../../types'
import TableView from './TableView'
import ChartView from './ChartView'
import SQLView from './SQLView'
import './ResultsPanel.css'

type Tab = 'table' | 'chart' | 'sql'

interface ResultsPanelProps {
  run: Run | null
  isLoading?: boolean
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getTotalMs(run: Run): number {
  return run.queries_executed.reduce((sum, q) => sum + q.execution_time_ms, 0)
}


export default function ResultsPanel({ run, isLoading }: ResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('table')
  const [sqlCopied, setSqlCopied] = useState(false)

  const sql = run?.queries_executed[0]?.sql ?? ''
  const totalMs = run ? getTotalMs(run) : 0

  const availableTabs: Tab[] = []
  if (run?.table_data) availableTabs.push('table')
  if (run?.chart_spec) availableTabs.push('chart')
  if (sql) availableTabs.push('sql')

  const currentTab = availableTabs.includes(activeTab)
    ? activeTab
    : availableTabs[0] ?? 'table'

  async function handleDownload() {
    // In a real app, call the API for xlsx download
    alert('Download feature: would call /api/runs/:id/export')
  }

  async function handleCopySQL() {
    try {
      await navigator.clipboard.writeText(sql)
      setSqlCopied(true)
      setTimeout(() => setSqlCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  // Empty state
  if (!run && !isLoading) {
    return (
      <div className="results-panel results-panel--empty">
        <div className="results-panel__placeholder">
          <div className="results-panel__placeholder-icon">
            <svg viewBox="0 0 64 64" fill="none">
              <rect x="8" y="16" width="48" height="36" rx="4" stroke="var(--border-default)" strokeWidth="2" />
              <line x1="8" y1="26" x2="56" y2="26" stroke="var(--border-default)" strokeWidth="2" />
              <line x1="24" y1="16" x2="24" y2="52" stroke="var(--border-default)" strokeWidth="2" />
              <circle cx="48" cy="44" r="10" fill="var(--bg-elevated)" stroke="var(--border-default)" strokeWidth="2" />
              <line x1="48" y1="40" x2="48" y2="48" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
              <line x1="44" y1="44" x2="52" y2="44" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h3>Results will appear here</h3>
          <p>Ask a question to see tables, charts, and SQL queries</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading && !run) {
    return (
      <div className="results-panel results-panel--loading">
        <div className="results-panel__skeleton-header skeleton" style={{ height: 60, margin: '1rem' }} />
        <div style={{ padding: '0 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 32, opacity: 1 - i * 0.08 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!run) return null

  return (
    <div className="results-panel">
      {/* Run header */}
      <div className="results-panel__header">
        <div className="results-panel__header-main">
          <p className="results-panel__question">{run.question}</p>
          <div className="results-panel__meta">
            {run.completed_at && (
              <span className="results-panel__meta-item">{formatTime(run.completed_at)}</span>
            )}
            {totalMs > 0 && (
              <span className="results-panel__meta-item results-panel__meta-item--accent">
                {formatMs(totalMs)}
              </span>
            )}
            {run.queries_executed[0]?.rows_returned != null && (
              <span className="results-panel__meta-item">
                {run.queries_executed[0].rows_returned.toLocaleString()} rows
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Answer text */}
      {run.answer_text && (
        <div className="results-panel__answer">
          <p>{run.answer_text}</p>
        </div>
      )}

      {/* Tabs */}
      {availableTabs.length > 0 && (
        <>
          <div className="results-panel__tabs">
            {availableTabs.map(tab => (
              <button
                key={tab}
                className={`results-panel__tab ${currentTab === tab ? 'results-panel__tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'table' && (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="1" width="14" height="14" rx="1" />
                    <line x1="1" y1="5" x2="15" y2="5" />
                    <line x1="1" y1="9" x2="15" y2="9" />
                    <line x1="6" y1="5" x2="6" y2="15" />
                  </svg>
                )}
                {tab === 'chart' && (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="1" y="9" width="3" height="5" />
                    <rect x="6" y="5" width="3" height="9" />
                    <rect x="11" y="2" width="3" height="12" />
                  </svg>
                )}
                {tab === 'sql' && (
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <polyline points="5 4 1 8 5 12" />
                    <polyline points="11 4 15 8 11 12" />
                    <line x1="9" y1="2" x2="7" y2="14" />
                  </svg>
                )}
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="results-panel__content">
            {currentTab === 'table' && run.table_data && (
              <TableView data={run.table_data} />
            )}
            {currentTab === 'chart' && run.chart_spec && (
              <ChartView spec={run.chart_spec} />
            )}
            {currentTab === 'sql' && sql && (
              <SQLView sql={sql} />
            )}
          </div>
        </>
      )}

      {/* Footer actions */}
      <div className="results-panel__footer">
        {run.sheet_download_url && (
          <button className="results-panel__footer-btn" onClick={handleDownload}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v9" />
              <polyline points="4,8 8,12 12,8" />
              <path d="M2 14h12" />
            </svg>
            Download .xlsx
          </button>
        )}
        {sql && (
          <button className="results-panel__footer-btn" onClick={handleCopySQL}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="5" y="5" width="9" height="9" rx="1" />
              <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
            </svg>
            {sqlCopied ? 'Copied!' : 'Copy SQL'}
          </button>
        )}
      </div>
    </div>
  )
}
