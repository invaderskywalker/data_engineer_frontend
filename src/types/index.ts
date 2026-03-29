export interface Connection {
  id: string
  name: string
  host: string
  port: number
  database: string
  username: string
  ssl: boolean
  status: 'active' | 'error' | 'connecting' | 'disconnected'
  created_at: string
  last_connected_at?: string
  table_count?: number
}

export interface ConnectionFormData {
  name: string
  host: string
  port: number
  database: string
  username: string
  password: string
  ssl: boolean
  connection_string?: string
}

export interface SchemaTable {
  name: string
  columns: SchemaColumn[]
  row_count_estimate: number
  description: string
}

export interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  is_pk: boolean
  is_fk: boolean
  references?: string
}

export interface SchemaSnapshot {
  tables: SchemaTable[]
  relationships: Relationship[]
  suggested_questions: string[]
}

export interface Relationship {
  from: string
  to: string
  type: string
}

export interface Session {
  id: string
  connection_id: string
  connection_name: string
  title: string
  created_at: string
  last_active_at: string
  run_count: number
}

export interface Run {
  id: string
  session_id: string
  question: string
  answer_text: string
  queries_executed: QueryExecution[]
  table_data?: TableData
  chart_spec?: ChartSpec
  sheet_download_url?: string
  status: 'pending' | 'running' | 'done' | 'error'
  error_message?: string
  created_at: string
  completed_at?: string
}

export interface QueryExecution {
  sql: string
  rows_returned: number
  execution_time_ms: number
}

export interface TableData {
  columns: string[]
  rows: (string | number | null)[][]
}

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'area' | 'scatter'
  title: string
  x_axis: { key: string; label: string }
  y_axis: { key: string; label: string }
  data: Record<string, string | number>[]
}

export interface AgentStep {
  type: 'planning' | 'sql_generated' | 'executing' | 'formatting' | 'done' | 'error'
  message: string
  sql?: string
  timestamp: string
}
