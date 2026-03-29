import type { Connection, ConnectionFormData, SchemaSnapshot } from '../types'
import { IS_MOCK, randomDelay, apiFetch } from './client'

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CONNECTIONS: Connection[] = [
  {
    id: 'conn-1',
    name: 'E-commerce Production',
    host: 'db.shop.io',
    port: 5432,
    database: 'ecommerce',
    username: 'app_user',
    ssl: true,
    status: 'active',
    created_at: '2026-01-15T10:00:00Z',
    last_connected_at: '2026-03-29T08:30:00Z',
    table_count: 23,
  },
  {
    id: 'conn-2',
    name: 'Analytics Warehouse',
    host: 'analytics.internal',
    port: 5432,
    database: 'analytics_dw',
    username: 'readonly',
    ssl: true,
    status: 'active',
    created_at: '2026-02-01T09:00:00Z',
    last_connected_at: '2026-03-29T07:45:00Z',
    table_count: 47,
  },
  {
    id: 'conn-3',
    name: 'Staging',
    host: 'staging-db.shop.io',
    port: 5432,
    database: 'ecommerce_staging',
    username: 'dev_user',
    ssl: false,
    status: 'error',
    created_at: '2026-02-15T14:00:00Z',
    last_connected_at: '2026-03-28T16:00:00Z',
    table_count: 23,
  },
]

const MOCK_SCHEMA: SchemaSnapshot = {
  tables: [
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'user_id', type: 'uuid', nullable: false, is_pk: false, is_fk: true, references: 'users.id' },
        { name: 'total', type: 'numeric', nullable: false, is_pk: false, is_fk: false },
        { name: 'status', type: 'varchar', nullable: false, is_pk: false, is_fk: false },
        { name: 'created_at', type: 'timestamptz', nullable: false, is_pk: false, is_fk: false },
      ],
      row_count_estimate: 284750,
      description: 'Customer orders with totals and status',
    },
    {
      name: 'order_items',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'order_id', type: 'uuid', nullable: false, is_pk: false, is_fk: true, references: 'orders.id' },
        { name: 'product_id', type: 'uuid', nullable: false, is_pk: false, is_fk: true, references: 'products.id' },
        { name: 'quantity', type: 'int', nullable: false, is_pk: false, is_fk: false },
        { name: 'price', type: 'numeric', nullable: false, is_pk: false, is_fk: false },
      ],
      row_count_estimate: 891200,
      description: 'Individual line items within orders',
    },
    {
      name: 'products',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'name', type: 'varchar', nullable: false, is_pk: false, is_fk: false },
        { name: 'category', type: 'varchar', nullable: true, is_pk: false, is_fk: false },
        { name: 'price', type: 'numeric', nullable: false, is_pk: false, is_fk: false },
        { name: 'stock', type: 'int', nullable: false, is_pk: false, is_fk: false },
      ],
      row_count_estimate: 4820,
      description: 'Product catalog with categories and pricing',
    },
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'email', type: 'varchar', nullable: false, is_pk: false, is_fk: false },
        { name: 'name', type: 'varchar', nullable: true, is_pk: false, is_fk: false },
        { name: 'created_at', type: 'timestamptz', nullable: false, is_pk: false, is_fk: false },
        { name: 'last_login', type: 'timestamptz', nullable: true, is_pk: false, is_fk: false },
      ],
      row_count_estimate: 127400,
      description: 'Registered user accounts',
    },
    {
      name: 'categories',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'name', type: 'varchar', nullable: false, is_pk: false, is_fk: false },
        { name: 'parent_id', type: 'uuid', nullable: true, is_pk: false, is_fk: true, references: 'categories.id' },
      ],
      row_count_estimate: 48,
      description: 'Product category hierarchy',
    },
    {
      name: 'reviews',
      columns: [
        { name: 'id', type: 'uuid', nullable: false, is_pk: true, is_fk: false },
        { name: 'product_id', type: 'uuid', nullable: false, is_pk: false, is_fk: true, references: 'products.id' },
        { name: 'user_id', type: 'uuid', nullable: false, is_pk: false, is_fk: true, references: 'users.id' },
        { name: 'rating', type: 'int', nullable: false, is_pk: false, is_fk: false },
        { name: 'body', type: 'text', nullable: true, is_pk: false, is_fk: false },
        { name: 'created_at', type: 'timestamptz', nullable: false, is_pk: false, is_fk: false },
      ],
      row_count_estimate: 38900,
      description: 'Customer product reviews and ratings',
    },
  ],
  relationships: [
    { from: 'orders.user_id', to: 'users.id', type: 'many-to-one' },
    { from: 'order_items.order_id', to: 'orders.id', type: 'many-to-one' },
    { from: 'order_items.product_id', to: 'products.id', type: 'many-to-one' },
    { from: 'reviews.product_id', to: 'products.id', type: 'many-to-one' },
    { from: 'reviews.user_id', to: 'users.id', type: 'many-to-one' },
    { from: 'categories.parent_id', to: 'categories.id', type: 'self-referential' },
  ],
  suggested_questions: [
    'What is my total revenue per category this month?',
    'Show user signups over the last 6 months',
    'Which products have the lowest stock levels?',
    'What is the average order value by customer segment?',
    'Which categories have the highest return rate?',
    'Show me the top 10 customers by lifetime value',
  ],
}

// In-memory store for mock connections (allows add/delete in session)
let mockConnections = [...MOCK_CONNECTIONS]

// ─── API functions ─────────────────────────────────────────────────────────────

export async function listConnections(): Promise<Connection[]> {
  if (IS_MOCK) {
    await randomDelay(300, 600)
    return [...mockConnections]
  }
  return apiFetch<Connection[]>('/connections')
}

export async function getConnection(id: string): Promise<Connection> {
  if (IS_MOCK) {
    await randomDelay(200, 400)
    const conn = mockConnections.find(c => c.id === id)
    if (!conn) throw new Error(`Connection ${id} not found`)
    return { ...conn }
  }
  return apiFetch<Connection>(`/connections/${id}`)
}

export async function createConnection(data: ConnectionFormData): Promise<Connection> {
  if (IS_MOCK) {
    await randomDelay(500, 900)
    const newConn: Connection = {
      id: `conn-${Date.now()}`,
      name: data.name,
      host: data.host,
      port: data.port,
      database: data.database,
      username: data.username,
      ssl: data.ssl,
      status: 'active',
      created_at: new Date().toISOString(),
      last_connected_at: new Date().toISOString(),
      table_count: Math.floor(Math.random() * 40) + 5,
    }
    mockConnections = [...mockConnections, newConn]
    return { ...newConn }
  }
  return apiFetch<Connection>('/connections', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function deleteConnection(id: string): Promise<void> {
  if (IS_MOCK) {
    await randomDelay(200, 400)
    mockConnections = mockConnections.filter(c => c.id !== id)
    return
  }
  return apiFetch<void>(`/connections/${id}`, { method: 'DELETE' })
}

export async function testConnection(id: string): Promise<{ success: boolean; message: string }> {
  if (IS_MOCK) {
    await randomDelay(800, 1500)
    const conn = mockConnections.find(c => c.id === id)
    if (!conn) return { success: false, message: 'Connection not found' }
    if (conn.status === 'error') {
      return { success: false, message: 'Connection refused: host unreachable' }
    }
    return { success: true, message: `Connected to ${conn.database} on ${conn.host}` }
  }
  return apiFetch<{ success: boolean; message: string }>(`/connections/${id}/test`, {
    method: 'POST',
  })
}

export async function testConnectionData(data: ConnectionFormData): Promise<{ success: boolean; message: string; table_count?: number }> {
  console.log("testConnectionData ", IS_MOCK)
  if (IS_MOCK) {
    await randomDelay(1000, 2000)
    if (!data.host || !data.database) {
      return { success: false, message: 'Invalid connection parameters' }
    }
    const tableCount = Math.floor(Math.random() * 40) + 5
    return {
      success: true,
      message: `Connected to ${data.database} on ${data.host}`,
      table_count: tableCount,
    }
  }
  return apiFetch<{ success: boolean; message: string; table_count?: number }>('/connections/test', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function refreshSchema(id: string): Promise<SchemaSnapshot> {
  if (IS_MOCK) {
    await randomDelay(600, 1200)
    return { ...MOCK_SCHEMA }
  }
  return apiFetch<SchemaSnapshot>(`/connections/${id}/schema/refresh`, { method: 'POST' })
}

export async function getSchema(id: string): Promise<SchemaSnapshot> {
  if (IS_MOCK) {
    await randomDelay(300, 600)
    // Return slightly different schema for different connections
    const tables = id === 'conn-2'
      ? MOCK_SCHEMA.tables.slice(0, 4).concat([
          {
            name: 'events',
            columns: [
              { name: 'id', type: 'bigint', nullable: false, is_pk: true, is_fk: false },
              { name: 'user_id', type: 'uuid', nullable: true, is_pk: false, is_fk: false },
              { name: 'event_type', type: 'varchar', nullable: false, is_pk: false, is_fk: false },
              { name: 'properties', type: 'jsonb', nullable: true, is_pk: false, is_fk: false },
              { name: 'timestamp', type: 'timestamptz', nullable: false, is_pk: false, is_fk: false },
            ],
            row_count_estimate: 12400000,
            description: 'Raw analytics event stream',
          },
          {
            name: 'sessions',
            columns: [
              { name: 'id', type: 'varchar', nullable: false, is_pk: true, is_fk: false },
              { name: 'user_id', type: 'uuid', nullable: true, is_pk: false, is_fk: false },
              { name: 'started_at', type: 'timestamptz', nullable: false, is_pk: false, is_fk: false },
              { name: 'ended_at', type: 'timestamptz', nullable: true, is_pk: false, is_fk: false },
              { name: 'page_views', type: 'int', nullable: false, is_pk: false, is_fk: false },
            ],
            row_count_estimate: 3800000,
            description: 'User browsing sessions',
          },
        ])
      : MOCK_SCHEMA.tables
    return {
      ...MOCK_SCHEMA,
      tables,
    }
  }
  return apiFetch<SchemaSnapshot>(`/connections/${id}/schema`)
}
