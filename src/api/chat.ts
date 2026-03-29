import type { Run, Session } from '../types'
import { IS_MOCK, randomDelay, apiFetch } from './client'

// ─── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SESSIONS: Session[] = [
  {
    id: 'sess-1',
    connection_id: 'conn-1',
    connection_name: 'E-commerce Production',
    title: 'Revenue analysis by category',
    created_at: '2026-03-29T08:00:00Z',
    last_active_at: '2026-03-29T08:15:00Z',
    run_count: 2,
  },
  {
    id: 'sess-2',
    connection_id: 'conn-1',
    connection_name: 'E-commerce Production',
    title: 'Customer churn investigation',
    created_at: '2026-03-28T14:00:00Z',
    last_active_at: '2026-03-28T14:45:00Z',
    run_count: 4,
  },
  {
    id: 'sess-3',
    connection_id: 'conn-2',
    connection_name: 'Analytics Warehouse',
    title: 'Funnel conversion rates',
    created_at: '2026-03-27T11:00:00Z',
    last_active_at: '2026-03-27T11:30:00Z',
    run_count: 3,
  },
  {
    id: 'sess-4',
    connection_id: 'conn-2',
    connection_name: 'Analytics Warehouse',
    title: 'Weekly active users trend',
    created_at: '2026-03-25T09:00:00Z',
    last_active_at: '2026-03-25T09:20:00Z',
    run_count: 2,
  },
]

const MOCK_RUNS: Record<string, Run[]> = {
  'sess-1': [
    {
      id: 'run-1',
      session_id: 'sess-1',
      question: 'What is my total revenue per category this month?',
      answer_text:
        "Here is your revenue breakdown by product category for March 2026. Electronics leads significantly at $142,000, followed by Clothing at $98,000. Home & Garden and Sports are mid-tier performers. Books and Beauty categories are underperforming relative to other segments — you may want to investigate promotional opportunities there.",
      queries_executed: [
        {
          sql: `SELECT\n  p.category,\n  SUM(oi.price * oi.quantity) AS revenue\nFROM orders o\nJOIN order_items oi ON o.id = oi.order_id\nJOIN products p ON oi.product_id = p.id\nWHERE\n  o.created_at >= DATE_TRUNC('month', NOW())\n  AND o.status = 'completed'\nGROUP BY p.category\nORDER BY revenue DESC`,
          rows_returned: 6,
          execution_time_ms: 142,
        },
      ],
      table_data: {
        columns: ['category', 'revenue'],
        rows: [
          ['Electronics', 142000],
          ['Clothing', 98000],
          ['Home & Garden', 71500],
          ['Sports', 54200],
          ['Books', 28400],
          ['Beauty', 19800],
        ],
      },
      chart_spec: {
        type: 'bar',
        title: 'Revenue by Category — March 2026',
        x_axis: { key: 'category', label: 'Category' },
        y_axis: { key: 'revenue', label: 'Revenue ($)' },
        data: [
          { category: 'Electronics', revenue: 142000 },
          { category: 'Clothing', revenue: 98000 },
          { category: 'Home & Garden', revenue: 71500 },
          { category: 'Sports', revenue: 54200 },
          { category: 'Books', revenue: 28400 },
          { category: 'Beauty', revenue: 19800 },
        ],
      },
      sheet_download_url: '#',
      status: 'done',
      created_at: '2026-03-29T08:00:00Z',
      completed_at: '2026-03-29T08:00:15Z',
    },
    {
      id: 'run-2',
      session_id: 'sess-1',
      question: 'Show user signups over the last 6 months',
      answer_text:
        'User signups have shown a strong upward trend over the past 6 months, growing from 1,842 in October to 3,291 in March — a 79% increase. The acceleration in February and March suggests your recent marketing campaigns are having a measurable impact.',
      queries_executed: [
        {
          sql: `SELECT\n  DATE_TRUNC('month', created_at) AS month,\n  COUNT(*) AS signups\nFROM users\nWHERE created_at >= NOW() - INTERVAL '6 months'\nGROUP BY month\nORDER BY month ASC`,
          rows_returned: 6,
          execution_time_ms: 87,
        },
      ],
      table_data: {
        columns: ['month', 'signups'],
        rows: [
          ['Oct 2025', 1842],
          ['Nov 2025', 2105],
          ['Dec 2025', 1978],
          ['Jan 2026', 2340],
          ['Feb 2026', 2890],
          ['Mar 2026', 3291],
        ],
      },
      chart_spec: {
        type: 'line',
        title: 'User Signups — Last 6 Months',
        x_axis: { key: 'month', label: 'Month' },
        y_axis: { key: 'signups', label: 'New Signups' },
        data: [
          { month: 'Oct 2025', signups: 1842 },
          { month: 'Nov 2025', signups: 2105 },
          { month: 'Dec 2025', signups: 1978 },
          { month: 'Jan 2026', signups: 2340 },
          { month: 'Feb 2026', signups: 2890 },
          { month: 'Mar 2026', signups: 3291 },
        ],
      },
      sheet_download_url: '#',
      status: 'done',
      created_at: '2026-03-29T08:10:00Z',
      completed_at: '2026-03-29T08:10:09Z',
    },
  ],
  'sess-2': [
    {
      id: 'run-3',
      session_id: 'sess-2',
      question: 'Which customers haven\'t ordered in the last 90 days?',
      answer_text:
        'Found 12,847 customers who were active previously but have not placed an order in the last 90 days. This represents approximately 10.1% of your total customer base. Consider a re-engagement email campaign targeting these users.',
      queries_executed: [
        {
          sql: `SELECT\n  u.id,\n  u.email,\n  u.name,\n  MAX(o.created_at) AS last_order_date,\n  COUNT(o.id) AS total_orders\nFROM users u\nLEFT JOIN orders o ON u.id = o.user_id\nGROUP BY u.id, u.email, u.name\nHAVING MAX(o.created_at) < NOW() - INTERVAL '90 days'\n   OR MAX(o.created_at) IS NULL\nORDER BY last_order_date DESC NULLS LAST\nLIMIT 100`,
          rows_returned: 100,
          execution_time_ms: 234,
        },
      ],
      table_data: {
        columns: ['email', 'name', 'last_order_date', 'total_orders'],
        rows: [
          ['alice@example.com', 'Alice Johnson', '2025-12-28', 7],
          ['bob.smith@mail.com', 'Bob Smith', '2025-12-27', 3],
          ['carol.w@example.com', 'Carol Williams', '2025-12-26', 12],
          ['dave.jones@mail.com', 'Dave Jones', '2025-12-25', 2],
          ['emma.d@example.com', 'Emma Davis', '2025-12-24', 5],
        ],
      },
      status: 'done',
      created_at: '2026-03-28T14:00:00Z',
      completed_at: '2026-03-28T14:00:28Z',
    },
  ],
  'sess-3': [
    {
      id: 'run-4',
      session_id: 'sess-3',
      question: 'What is the checkout funnel conversion rate?',
      answer_text:
        'Your checkout funnel shows significant drop-off at the payment step. Of 45,200 users who start checkout, only 18,900 (41.8%) complete a purchase. The biggest loss is between cart and checkout initiation (58% → 38%), suggesting friction in your checkout form.',
      queries_executed: [
        {
          sql: `SELECT\n  event_type,\n  COUNT(DISTINCT user_id) AS users\nFROM events\nWHERE event_type IN ('view_product', 'add_to_cart', 'begin_checkout', 'add_payment', 'purchase')\n  AND timestamp >= NOW() - INTERVAL '30 days'\nGROUP BY event_type\nORDER BY\n  CASE event_type\n    WHEN 'view_product' THEN 1\n    WHEN 'add_to_cart' THEN 2\n    WHEN 'begin_checkout' THEN 3\n    WHEN 'add_payment' THEN 4\n    WHEN 'purchase' THEN 5\n  END`,
          rows_returned: 5,
          execution_time_ms: 312,
        },
      ],
      table_data: {
        columns: ['step', 'users', 'conversion'],
        rows: [
          ['View Product', 108400, '100%'],
          ['Add to Cart', 62900, '58.0%'],
          ['Begin Checkout', 45200, '41.7%'],
          ['Add Payment', 28100, '25.9%'],
          ['Purchase', 18900, '17.4%'],
        ],
      },
      chart_spec: {
        type: 'bar',
        title: 'Checkout Funnel — Last 30 Days',
        x_axis: { key: 'step', label: 'Funnel Step' },
        y_axis: { key: 'users', label: 'Users' },
        data: [
          { step: 'View Product', users: 108400 },
          { step: 'Add to Cart', users: 62900 },
          { step: 'Checkout', users: 45200 },
          { step: 'Payment', users: 28100 },
          { step: 'Purchase', users: 18900 },
        ],
      },
      status: 'done',
      created_at: '2026-03-27T11:00:00Z',
      completed_at: '2026-03-27T11:00:35Z',
    },
  ],
}

let mockRunsStore = { ...MOCK_RUNS }
let mockSessionsStore = [...MOCK_SESSIONS]

// ─── API functions ──────────────────────────────────────────────────────────────

export async function listSessions(connectionId?: string): Promise<Session[]> {
  if (IS_MOCK) {
    await randomDelay(300, 500)
    if (connectionId) {
      return mockSessionsStore.filter(s => s.connection_id === connectionId)
    }
    return [...mockSessionsStore]
  }
  const query = connectionId ? `?connection_id=${connectionId}` : ''
  return apiFetch<Session[]>(`/sessions${query}`)
}

export async function getSession(sessionId: string): Promise<Session & { runs: Run[] }> {
  if (IS_MOCK) {
    await randomDelay(300, 500)
    const session = mockSessionsStore.find(s => s.id === sessionId)
    if (!session) throw new Error(`Session ${sessionId} not found`)
    const runs = mockRunsStore[sessionId] ?? []
    return { ...session, runs }
  }
  return apiFetch<Session & { runs: Run[] }>(`/sessions/${sessionId}`)
}

export async function getRun(runId: string): Promise<Run> {
  if (IS_MOCK) {
    await randomDelay(200, 400)
    for (const runs of Object.values(mockRunsStore)) {
      const run = runs.find(r => r.id === runId)
      if (run) return { ...run }
    }
    throw new Error(`Run ${runId} not found`)
  }
  return apiFetch<Run>(`/runs/${runId}`)
}

export async function askQuestion(
  connectionId: string,
  question: string,
  sessionId?: string
): Promise<Run> {
  if (IS_MOCK) {
    await randomDelay(400, 700)

    let targetSessionId = sessionId

    if (!targetSessionId) {
      const newSession: Session = {
        id: `sess-${Date.now()}`,
        connection_id: connectionId,
        connection_name: 'E-commerce Production',
        title: question.slice(0, 60),
        created_at: new Date().toISOString(),
        last_active_at: new Date().toISOString(),
        run_count: 0,
      }
      mockSessionsStore = [...mockSessionsStore, newSession]
      targetSessionId = newSession.id
    }

    const pendingRun: Run = {
      id: `run-${Date.now()}`,
      session_id: targetSessionId,
      question,
      answer_text: '',
      queries_executed: [],
      status: 'running',
      created_at: new Date().toISOString(),
    }

    if (!mockRunsStore[targetSessionId]) {
      mockRunsStore[targetSessionId] = []
    }
    mockRunsStore[targetSessionId] = [...mockRunsStore[targetSessionId], pendingRun]

    // Update session run count
    mockSessionsStore = mockSessionsStore.map(s =>
      s.id === targetSessionId
        ? { ...s, run_count: s.run_count + 1, last_active_at: new Date().toISOString() }
        : s
    )

    return { ...pendingRun }
  }
  return apiFetch<Run>(`/connections/${connectionId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question, session_id: sessionId }),
  })
}

export async function completeRun(runId: string, sessionId: string): Promise<Run> {
  if (IS_MOCK) {
    await randomDelay(2000, 4000)

    const completedRun: Run = {
      id: runId,
      session_id: sessionId,
      question: 'What is my total revenue per category this month?',
      answer_text:
        "Here is your revenue breakdown by product category for March 2026. Electronics leads at $142,000. The data shows strong performance across most categories.",
      queries_executed: [
        {
          sql: `SELECT p.category, SUM(oi.price * oi.quantity) AS revenue\nFROM orders o\nJOIN order_items oi ON o.id = oi.order_id\nJOIN products p ON oi.product_id = p.id\nWHERE o.created_at >= DATE_TRUNC('month', NOW())\nGROUP BY p.category\nORDER BY revenue DESC`,
          rows_returned: 6,
          execution_time_ms: 142,
        },
      ],
      table_data: {
        columns: ['category', 'revenue'],
        rows: [
          ['Electronics', 142000],
          ['Clothing', 98000],
          ['Home & Garden', 71500],
          ['Sports', 54200],
          ['Books', 28400],
          ['Beauty', 19800],
        ],
      },
      chart_spec: {
        type: 'bar',
        title: 'Revenue by Category',
        x_axis: { key: 'category', label: 'Category' },
        y_axis: { key: 'revenue', label: 'Revenue ($)' },
        data: [
          { category: 'Electronics', revenue: 142000 },
          { category: 'Clothing', revenue: 98000 },
          { category: 'Home & Garden', revenue: 71500 },
          { category: 'Sports', revenue: 54200 },
          { category: 'Books', revenue: 28400 },
          { category: 'Beauty', revenue: 19800 },
        ],
      },
      status: 'done',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }

    // Update in store
    if (mockRunsStore[sessionId]) {
      mockRunsStore[sessionId] = mockRunsStore[sessionId].map(r =>
        r.id === runId ? completedRun : r
      )
    }

    return completedRun
  }
  return apiFetch<Run>(`/runs/${runId}`)
}
