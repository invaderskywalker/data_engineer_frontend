import { useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  Position,
  Handle,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { SchemaSnapshot, SchemaTable } from '../../types'
import './SchemaFlow.css'

// ── Table node ──────────────────────────────────────────────────────────────

interface TableNodeData {
  table: SchemaTable
  [key: string]: unknown
}

function TableNode({ data }: { data: TableNodeData }) {
  const { table } = data
  return (
    <div className="sflow-node">
      <Handle type="target" position={Position.Left} className="sflow-node__handle" />
      <Handle type="source" position={Position.Right} className="sflow-node__handle" />

      <div className="sflow-node__header">
        <svg className="sflow-node__icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="1" y="1" width="12" height="12" rx="1.5" />
          <line x1="1" y1="5" x2="13" y2="5" />
          <line x1="5" y1="5" x2="5" y2="13" />
        </svg>
        <span className="sflow-node__table-name">{table.name}</span>
        {table.row_count_estimate > 0 && (
          <span className="sflow-node__row-count">{formatCount(table.row_count_estimate)}</span>
        )}
      </div>

      {table.columns.length > 0 ? (
        <div className="sflow-node__cols">
          {table.columns.slice(0, 7).map(col => (
            <div key={col.name} className="sflow-node__col">
              <span className={`sflow-node__badge ${col.is_pk ? 'sflow-node__badge--pk' : col.is_fk ? 'sflow-node__badge--fk' : 'sflow-node__badge--empty'}`}>
                {col.is_pk ? 'PK' : col.is_fk ? 'FK' : ''}
              </span>
              <span className="sflow-node__col-name">{col.name}</span>
              <span className="sflow-node__col-type">{col.type}</span>
            </div>
          ))}
          {table.columns.length > 7 && (
            <div className="sflow-node__col sflow-node__col--more">
              +{table.columns.length - 7} more
            </div>
          )}
        </div>
      ) : (
        <div className="sflow-node__empty-cols">no columns loaded</div>
      )}
    </div>
  )
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

// ── Graph builder ────────────────────────────────────────────────────────────

function buildGraph(schema: SchemaSnapshot): { nodes: Node[]; edges: Edge[] } {
  const tables = schema.tables
  const COLS = tables.length <= 2 ? tables.length : Math.min(4, Math.ceil(Math.sqrt(tables.length * 1.4)))
  const NODE_W = 220
  const COL_H = 26
  const HEADER_H = 44
  const PADDING_H = 10

  function nodeH(t: SchemaTable) {
    const colRows = Math.min(t.columns.length, 7) + (t.columns.length > 7 ? 1 : 0)
    return HEADER_H + colRows * COL_H + PADDING_H + (t.columns.length === 0 ? 28 : 0)
  }

  const numRows = Math.ceil(tables.length / COLS)
  const rowMaxH: number[] = Array(numRows).fill(0)
  tables.forEach((t, i) => {
    const r = Math.floor(i / COLS)
    rowMaxH[r] = Math.max(rowMaxH[r], nodeH(t))
  })

  const rowY: number[] = []
  let y = 0
  rowMaxH.forEach(h => { rowY.push(y); y += h + 60 })

  const posMap = new Set<string>()
  const nodes: Node[] = tables.map((table, i) => {
    const c = i % COLS
    const r = Math.floor(i / COLS)
    posMap.add(table.name)
    return {
      id: table.name,
      type: 'tableNode',
      position: { x: c * (NODE_W + 60), y: rowY[r] },
      data: { table } as TableNodeData,
    }
  })

  const seenEdges = new Set<string>()
  const edges: Edge[] = schema.relationships
    .map((rel, i) => {
      const src = rel.from.split('.')[0]
      const tgt = rel.to.split('.')[0]
      if (!posMap.has(src) || !posMap.has(tgt) || src === tgt) return null
      const key = `${src}--${tgt}`
      if (seenEdges.has(key)) return null
      seenEdges.add(key)
      const label = rel.type === 'many-to-one' ? 'N:1' : rel.type === 'one-to-many' ? '1:N' : rel.type
      return {
        id: `e-${i}`,
        source: src,
        target: tgt,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--accent)' },
        style: { stroke: 'var(--accent)', strokeWidth: 1.5, opacity: 0.55 },
        label,
        labelStyle: { fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'inherit' },
        labelBgStyle: { fill: 'var(--bg-surface)', fillOpacity: 0.9 },
      }
    })
    .filter(Boolean) as Edge[]

  return { nodes, edges }
}

const nodeTypes = { tableNode: TableNode }

// ── Overview tab ─────────────────────────────────────────────────────────────

function SchemaOverview({ schema }: { schema: SchemaSnapshot }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  return (
    <div className="sflow-overview">
      {schema.tables.map(table => {
        const open = expanded.has(table.name)
        return (
          <div key={table.name} className="sflow-overview__table">
            <button
              className="sflow-overview__table-row"
              onClick={() => toggle(table.name)}
            >
              <svg
                className={`sflow-overview__chevron ${open ? 'sflow-overview__chevron--open' : ''}`}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"
              >
                <polyline points="3,4.5 6,7.5 9,4.5" />
              </svg>
              <svg className="sflow-overview__table-icon" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="0.5" y="0.5" width="11" height="11" rx="1.5" />
                <line x1="0.5" y1="4" x2="11.5" y2="4" />
                <line x1="4" y1="4" x2="4" y2="11.5" />
              </svg>
              <span className="sflow-overview__table-name">{table.name}</span>
              {table.row_count_estimate > 0 && (
                <span className="sflow-overview__count">{formatCount(table.row_count_estimate)}</span>
              )}
              {table.columns.length > 0 && (
                <span className="sflow-overview__col-count">{table.columns.length}c</span>
              )}
            </button>

            {open && table.columns.length > 0 && (
              <div className="sflow-overview__cols">
                {table.columns.map(col => (
                  <div key={col.name} className="sflow-overview__col">
                    <span className={`sflow-overview__badge ${col.is_pk ? 'sflow-overview__badge--pk' : col.is_fk ? 'sflow-overview__badge--fk' : ''}`}>
                      {col.is_pk ? 'PK' : col.is_fk ? 'FK' : ''}
                    </span>
                    <span className="sflow-overview__col-name">{col.name}</span>
                    <span className="sflow-overview__col-type">{col.type}</span>
                    {col.references && (
                      <span className="sflow-overview__col-ref">→ {col.references}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

interface SchemaFlowProps {
  schema: SchemaSnapshot | null
  onCollapse?: () => void
  defaultTab?: 'diagram' | 'overview'
}

export default function SchemaFlow({ schema, onCollapse, defaultTab = 'diagram' }: SchemaFlowProps) {
  const [tab, setTab] = useState<'diagram' | 'overview'>(defaultTab)

  const { nodes, edges } = useMemo(() => {
    if (!schema || schema.tables.length === 0) return { nodes: [], edges: [] }
    return buildGraph(schema)
  }, [schema])

  return (
    <div className="sflow">
      {/* Header */}
      <div className="sflow__header">
        <svg className="sflow__db-icon" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
          <ellipse cx="7" cy="3" rx="5.5" ry="2" />
          <path d="M1.5 3v3c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V3" />
          <path d="M1.5 6v3c0 1.1 2.46 2 5.5 2s5.5-.9 5.5-2V6" />
        </svg>
        <span className="sflow__title">Schema</span>
        {schema && (
          <span className="sflow__meta">{schema.tables.length}T · {schema.relationships.length}R</span>
        )}
        {onCollapse && (
          <button className="sflow__collapse-btn" onClick={onCollapse} title="Collapse">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <polyline points="10,4 6,8 10,12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="sflow__tabs">
        <button
          className={`sflow__tab ${tab === 'diagram' ? 'sflow__tab--active' : ''}`}
          onClick={() => setTab('diagram')}
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="5" width="4" height="4" rx="1" />
            <rect x="9" y="1" width="4" height="4" rx="1" />
            <rect x="9" y="9" width="4" height="4" rx="1" />
            <line x1="5" y1="7" x2="9" y2="3" />
            <line x1="5" y1="7" x2="9" y2="11" />
          </svg>
          Diagram
        </button>
        <button
          className={`sflow__tab ${tab === 'overview' ? 'sflow__tab--active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="4" x2="12" y2="4" />
            <line x1="2" y1="7" x2="12" y2="7" />
            <line x1="2" y1="10" x2="8" y2="10" />
          </svg>
          Overview
        </button>
      </div>

      {/* Content */}
      <div className="sflow__canvas">
        {!schema ? (
          <div className="sflow__placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
            </svg>
            <span>Loading schema...</span>
          </div>
        ) : tab === 'diagram' ? (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={2.5}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--border-subtle)" />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={() => 'var(--bg-elevated)'}
              maskColor="rgba(100,100,120,0.12)"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
            />
          </ReactFlow>
        ) : (
          <SchemaOverview schema={schema} />
        )}
      </div>
    </div>
  )
}
