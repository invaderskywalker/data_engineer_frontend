import { useState } from 'react'
import './SQLView.css'

interface SQLViewProps {
  sql: string
}

const SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL',
  'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'BY', 'ORDER', 'GROUP',
  'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'ALL', 'DISTINCT', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'WITH', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
  'DELETE', 'CREATE', 'TABLE', 'INDEX', 'DROP', 'ALTER', 'ADD', 'COLUMN',
  'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'DATE_TRUNC', 'NOW', 'INTERVAL',
  'EXTRACT', 'COALESCE', 'NULLIF', 'CAST', 'BETWEEN', 'LIKE', 'ILIKE', 'ASC',
  'DESC', 'NULLS', 'LAST', 'FIRST', 'OVER', 'PARTITION', 'ROW_NUMBER',
  'RANK', 'DENSE_RANK', 'LAG', 'LEAD', 'CROSS',
]

function highlightSQL(sql: string): string {
  // Escape HTML first
  let escaped = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Highlight single-line comments
  escaped = escaped.replace(/(--[^\n]*)/g, '<span class="sql-comment">$1</span>')

  // Highlight strings
  escaped = escaped.replace(/('(?:[^'\\]|\\.)*')/g, '<span class="sql-string">$1</span>')

  // Highlight numbers
  escaped = escaped.replace(/\b(\d+(\.\d+)?)\b/g, '<span class="sql-number">$1</span>')

  // Highlight keywords (case-insensitive)
  const keywordPattern = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi')
  escaped = escaped.replace(keywordPattern, '<span class="sql-keyword">$1</span>')

  return escaped
}

export default function SQLView({ sql }: SQLViewProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const lines = sql.split('\n')
  const highlighted = highlightSQL(sql)
  const highlightedLines = highlighted.split('\n')

  return (
    <div className="sql-view">
      <div className="sql-view__header">
        <span className="sql-view__label">SQL Query</span>
        <button className="sql-view__copy-btn" onClick={handleCopy}>
          {copied ? (
            <>
              <svg viewBox="0 0 16 16" fill="none">
                <polyline points="2,8 6,12 14,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="5" y="5" width="9" height="9" rx="1" />
                <path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      <div className="sql-view__code">
        <div className="sql-view__gutter">
          {lines.map((_, i) => (
            <span key={i} className="sql-view__line-num">{i + 1}</span>
          ))}
        </div>
        <pre className="sql-view__pre">
          <code>
            {highlightedLines.map((line, i) => (
              <span key={i} className="sql-view__line" dangerouslySetInnerHTML={{ __html: line + '\n' }} />
            ))}
          </code>
        </pre>
      </div>
    </div>
  )
}
