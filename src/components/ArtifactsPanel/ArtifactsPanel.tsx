import { useState, useRef } from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import type { Run, ChartSpec, TableData } from '../../types'
import './ArtifactsPanel.css'

// ── Sheet view ───────────────────────────────────────────────────────────────

function SheetView({ data }: { data: TableData }) {
  if (!data.rows.length) {
    return <div className="artifacts__empty-inner">No rows returned</div>
  }

  return (
    <div className="artifacts__sheet">
      <table className="artifacts__table">
        <thead>
          <tr>
            {data.columns.map(col => (
              <th key={col} className="artifacts__th">{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="artifacts__tr">
              {row.map((cell, j) => (
                <td key={j} className="artifacts__td">
                  {cell === null ? <span className="artifacts__null">null</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Chart view ───────────────────────────────────────────────────────────────

function buildHighchartsOptions(spec: ChartSpec): Highcharts.Options {
  const seriesData = spec.data.map(row => ({
    name: String(row[spec.x_axis.key] ?? ''),
    y: Number(row[spec.y_axis.key] ?? 0),
  }))

  const typeMap: Record<ChartSpec['type'], string> = {
    bar: 'column',
    line: 'line',
    pie: 'pie',
    area: 'area',
    scatter: 'scatter',
  }

  const hcType = typeMap[spec.type] ?? 'column'

  if (hcType === 'pie') {
    return {
      chart: { type: 'pie', backgroundColor: 'transparent', style: { fontFamily: 'inherit' } },
      title: { text: spec.title, style: { color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' } },
      series: [{ type: 'pie', name: spec.y_axis.label, data: seriesData }] as Highcharts.SeriesOptionsType[],
      credits: { enabled: false },
      legend: { itemStyle: { color: 'var(--text-secondary)', fontSize: '11px' } },
    }
  }

  return {
    chart: { type: hcType, backgroundColor: 'transparent', style: { fontFamily: 'inherit' } },
    title: { text: spec.title, style: { color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600' } },
    xAxis: {
      categories: spec.data.map(row => String(row[spec.x_axis.key] ?? '')),
      title: { text: spec.x_axis.label, style: { color: 'var(--text-muted)', fontSize: '11px' } },
      labels: { style: { color: 'var(--text-secondary)', fontSize: '10px' } },
      lineColor: 'var(--border-subtle)',
      tickColor: 'var(--border-subtle)',
    },
    yAxis: {
      title: { text: spec.y_axis.label, style: { color: 'var(--text-muted)', fontSize: '11px' } },
      labels: { style: { color: 'var(--text-secondary)', fontSize: '10px' } },
      gridLineColor: 'var(--border-subtle)',
    },
    series: [{
      type: hcType as Highcharts.SeriesOptionsType['type'],
      name: spec.y_axis.label,
      data: seriesData.map(d => d.y),
      color: 'var(--accent)',
    }] as Highcharts.SeriesOptionsType[],
    plotOptions: {
      series: { animation: { duration: 300 } },
    },
    credits: { enabled: false },
    legend: { enabled: false },
    tooltip: {
      backgroundColor: 'var(--bg-elevated)',
      borderColor: 'var(--border-default)',
      style: { color: 'var(--text-primary)', fontSize: '11px' },
    },
  }
}

function ChartView({ spec }: { spec: ChartSpec }) {
  const chartRef = useRef<HighchartsReact.RefObject>(null)
  const options = buildHighchartsOptions(spec)

  return (
    <div className="artifacts__chart">
      <HighchartsReact highcharts={Highcharts} options={options} ref={chartRef} />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface ArtifactsPanelProps {
  run: Run | null
}

type ArtifactTab = 'sheet' | 'chart'

export default function ArtifactsPanel({ run }: ArtifactsPanelProps) {
  const [tab, setTab] = useState<ArtifactTab>('sheet')

  const hasSheet = run?.status === 'done' && run.table_data && run.table_data.rows.length > 0
  const hasChart = run?.status === 'done' && !!run.chart_spec

  const isLoading = run?.status === 'pending' || run?.status === 'running'

  return (
    <div className="artifacts">
      {/* Header */}
      <div className="artifacts__header">
        <div className="artifacts__tabs">
          <button
            className={`artifacts__tab ${tab === 'sheet' ? 'artifacts__tab--active' : ''}`}
            onClick={() => setTab('sheet')}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="12" height="12" rx="1.5" />
              <line x1="1" y1="5" x2="13" y2="5" />
              <line x1="1" y1="9" x2="13" y2="9" />
              <line x1="5" y1="5" x2="5" y2="13" />
            </svg>
            Sheet
          </button>
          <button
            className={`artifacts__tab ${tab === 'chart' ? 'artifacts__tab--active' : ''}`}
            onClick={() => setTab('chart')}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="1,11 4,7 7,9 10,4 13,6" />
            </svg>
            Chart
          </button>
        </div>

        {run?.status === 'done' && run.table_data && (
          <span className="artifacts__meta">
            {run.table_data.rows.length} rows
          </span>
        )}
      </div>

      {/* Content */}
      <div className="artifacts__body">
        {!run && (
          <div className="artifacts__empty">
            <svg viewBox="0 0 48 48" fill="none">
              <rect x="8" y="6" width="32" height="36" rx="3" stroke="var(--border-default)" strokeWidth="1.8" />
              <line x1="8" y1="14" x2="40" y2="14" stroke="var(--border-default)" strokeWidth="1.5" />
              <line x1="8" y1="22" x2="40" y2="22" stroke="var(--border-default)" strokeWidth="1.5" />
              <line x1="8" y1="30" x2="32" y2="30" stroke="var(--border-default)" strokeWidth="1.5" />
              <line x1="18" y1="14" x2="18" y2="42" stroke="var(--border-default)" strokeWidth="1.5" />
            </svg>
            <p>Results will appear here</p>
          </div>
        )}

        {isLoading && (
          <div className="artifacts__loading">
            <div className="artifacts__spinner">
              <svg viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="var(--border-default)" strokeWidth="3" />
                <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="3" strokeDasharray="32" strokeDashoffset="8" />
              </svg>
            </div>
            <p>Running query…</p>
          </div>
        )}

        {run?.status === 'done' && tab === 'sheet' && (
          hasSheet
            ? <SheetView data={run.table_data!} />
            : <div className="artifacts__empty-inner">No table data for this result</div>
        )}

        {run?.status === 'done' && tab === 'chart' && (
          hasChart
            ? <ChartView spec={run.chart_spec!} />
            : <div className="artifacts__empty-inner">No chart data for this result</div>
        )}

        {run?.status === 'error' && (
          <div className="artifacts__error">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="10" cy="10" r="8" />
              <line x1="10" y1="6" x2="10" y2="11" strokeLinecap="round" />
              <circle cx="10" cy="13.5" r="0.8" fill="currentColor" stroke="none" />
            </svg>
            {run.error_message ?? 'Query failed'}
          </div>
        )}
      </div>
    </div>
  )
}
