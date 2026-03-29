import { useState } from 'react'
import type { TableData } from '../../types'
import './TableView.css'

interface TableViewProps {
  data: TableData
}

type SortDir = 'asc' | 'desc'

function isNumericColumn(rows: (string | number | null)[][], colIndex: number): boolean {
  const sample = rows.slice(0, 10).map(r => r[colIndex])
  const nonNull = sample.filter(v => v !== null)
  return nonNull.length > 0 && nonNull.every(v => typeof v === 'number' || (typeof v === 'string' && !isNaN(Number(v)) && v.trim() !== ''))
}

function formatValue(v: string | number | null): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

export default function TableView({ data }: TableViewProps) {
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const isNumeric = data.columns.map((_, i) => isNumericColumn(data.rows, i))

  function handleSort(colIndex: number) {
    if (sortCol === colIndex) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(colIndex)
      setSortDir('asc')
    }
  }

  const sortedRows = sortCol !== null
    ? [...data.rows].sort((a, b) => {
        const av = a[sortCol]
        const bv = b[sortCol]
        if (av === null) return 1
        if (bv === null) return -1
        const comparison = isNumeric[sortCol]
          ? Number(av) - Number(bv)
          : String(av).localeCompare(String(bv))
        return sortDir === 'asc' ? comparison : -comparison
      })
    : data.rows

  return (
    <div className="table-view">
      <div className="table-view__scroll">
        <table className="table-view__table">
          <thead>
            <tr>
              {data.columns.map((col, i) => (
                <th
                  key={col}
                  className={`table-view__th ${isNumeric[i] ? 'table-view__th--num' : ''}`}
                  onClick={() => handleSort(i)}
                >
                  <span className="table-view__th-content">
                    {col}
                    <span className="table-view__sort-icon">
                      {sortCol === i ? (
                        sortDir === 'asc' ? '↑' : '↓'
                      ) : (
                        <span className="table-view__sort-placeholder">↕</span>
                      )}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'table-view__tr--even' : 'table-view__tr--odd'}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`table-view__td ${isNumeric[ci] ? 'table-view__td--num' : ''} ${cell === null ? 'table-view__td--null' : ''}`}
                  >
                    {formatValue(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-view__footer">
        Showing <strong>{sortedRows.length}</strong> of <strong>{data.rows.length}</strong> rows
      </div>
    </div>
  )
}
