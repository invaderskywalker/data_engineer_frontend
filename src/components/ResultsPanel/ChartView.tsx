import { useState } from 'react'
import type { ChartSpec } from '../../types'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import './ChartView.css'

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a78bfa']

type ChartType = 'bar' | 'line' | 'area' | 'pie'

interface ChartViewProps {
  spec: ChartSpec
}

function CustomTooltip({ active, payload, label }: {active?: boolean; payload?: {name: string; value: number; color: string}[]; label?: string}) {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="chart-view__tooltip">
      <p className="chart-view__tooltip-label">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="chart-view__tooltip-value" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  )
}

export default function ChartView({ spec }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>(spec.type as ChartType)

  const xKey = spec.x_axis.key
  const yKey = spec.y_axis.key
  const data = spec.data

  const commonProps = {
    data,
    margin: { top: 10, right: 20, left: 10, bottom: 20 },
  }

  const axisProps = {
    tick: { fill: 'var(--text-secondary)', fontSize: 12 },
    axisLine: { stroke: 'var(--border-default)' },
    tickLine: { stroke: 'var(--border-default)' },
  }

  const gridProps = {
    stroke: 'var(--border-subtle)',
    strokeDasharray: '3 3',
  }

  function renderChart() {
    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid {...gridProps} vertical={false} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKey} fill={COLORS[0]} radius={[4, 4, 0, 0]} name={spec.y_axis.label}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey={yKey}
              stroke={COLORS[0]}
              strokeWidth={2.5}
              dot={{ fill: COLORS[0], strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: COLORS[0] }}
              name={spec.y_axis.label}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS[0]} stopOpacity={0.3} />
                <stop offset="95%" stopColor={COLORS[0]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey={xKey} {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v: number) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={yKey}
              stroke={COLORS[0]}
              strokeWidth={2.5}
              fill="url(#areaGradient)"
              name={spec.y_axis.label}
            />
          </AreaChart>
        )

      case 'pie': {
        return (
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={120}
              innerRadius={60}
              paddingAngle={2}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={{ stroke: 'var(--text-muted)' }}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              formatter={(value) => <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{value}</span>}
            />
          </PieChart>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="chart-view">
      <div className="chart-view__controls">
        <h3 className="chart-view__title">{spec.title}</h3>
        <div className="chart-view__type-toggle">
          {(['bar', 'line', 'area', 'pie'] as ChartType[]).map(type => (
            <button
              key={type}
              className={`chart-view__type-btn ${chartType === type ? 'chart-view__type-btn--active' : ''}`}
              onClick={() => setChartType(type)}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-view__chart">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() ?? <div />}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
