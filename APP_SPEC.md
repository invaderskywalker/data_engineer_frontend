# Data Engineer AI — Application Specification

**Version**: 0.1.0 (Draft)
**Last Updated**: 2026-03-29
**Status**: Living Document — updated iteratively

---

## 1. Overview

**Data Engineer AI** is a self-serve analytics platform where any user can connect their PostgreSQL database and immediately start asking natural language questions. The system auto-generates all required configuration, understands the schema, and returns structured answers — tables, sheets, and charts — grounded in the user's actual data.

**Core promise**: Connect a database → ask questions in plain English → get data, sheets, and charts back.

---

## 2. User Journey

```
1. User pastes a Postgres connection string (or fills host/port/db/user/pass)
2. System connects, introspects schema, generates "DataEngineer Config"
3. User asks a question in natural language
4. SuperAgent routes the question → DataEngineer agent
5. DataEngineer queries the database → returns structured results
6. Frontend renders: table + downloadable sheet + chart(s)
```

---

## 3. System Architecture

```
┌─────────────────────────────────────────────┐
│              Frontend (React)                │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ DB Setup │  │ Chat/Q&A │  │ Results   │ │
│  │ Wizard   │  │ Interface│  │ Viewer    │ │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │
└───────┼─────────────┼───────────────┼────────┘
        │ REST/WS     │ REST/WS       │ REST
        ▼             ▼               ▼
┌─────────────────────────────────────────────┐
│           Data Engineer API (Flask)          │
│  ┌─────────────────────────────────────┐    │
│  │         SuperAgent (Router)          │    │
│  │  - Understands user intent           │    │
│  │  - Decides which queries to run      │    │
│  │  - Coordinates multi-step answers    │    │
│  └──────────────┬──────────────────────┘    │
│                 │                            │
│  ┌──────────────▼──────────────────────┐    │
│  │       DataEngineer Agent             │    │
│  │  - Reads DataEngineerConfig          │    │
│  │  - Generates SQL queries             │    │
│  │  - Executes against user's DB        │    │
│  │  - Formats results (table/sheet/chart│    │
│  └──────────────┬──────────────────────┘    │
└─────────────────┼────────────────────────────┘
                  │
     ┌────────────┼──────────────────────┐
     ▼            ▼                      ▼
 User's        App DB               S3 / Files
 PostgreSQL    (sessions,            (xlsx sheets,
 Database      configs, history)      chart images)
```

---

## 4. Core Concepts

### 4.1 DataEngineerConfig

Auto-generated when user connects their database. Stored in the app DB, scoped to the user's connection. This is the central config that drives all agent behavior — analogous to the `ai_dao` pattern in the existing codebase.

**Structure**:
```json
{
  "connection_id": "uuid",
  "user_id": "uuid",
  "db_host": "...",
  "db_name": "...",
  "schema_snapshot": {
    "tables": [
      {
        "name": "orders",
        "columns": [
          {"name": "id", "type": "integer", "nullable": false, "is_pk": true},
          {"name": "user_id", "type": "integer", "nullable": false, "is_fk": true, "references": "users.id"},
          {"name": "total", "type": "numeric", "nullable": false},
          {"name": "created_at", "type": "timestamp", "nullable": false}
        ],
        "row_count_estimate": 140000,
        "sample_rows": [...],
        "description": "LLM-generated: stores customer purchase transactions"
      }
    ],
    "relationships": [
      {"from": "orders.user_id", "to": "users.id", "type": "many-to-one"}
    ]
  },
  "semantic_layer": {
    "business_terms": {
      "revenue": "SUM(orders.total) WHERE status = 'completed'",
      "active_users": "COUNT(DISTINCT users.id) WHERE last_login > NOW() - INTERVAL '30 days'"
    },
    "suggested_questions": [
      "What is my total revenue this month?",
      "Which products are selling the most?",
      "Show me user growth over the last 6 months"
    ]
  },
  "created_at": "...",
  "last_refreshed_at": "..."
}
```

### 4.2 SuperAgent (Router)

The SuperAgent's role here is **routing and multi-step orchestration**:
- Understands user intent from the question
- Decides if a single query answers it OR if multiple queries are needed
- Breaks complex questions into sub-questions → sends each to DataEngineer
- Combines results into a final coherent answer
- Decides what visualization type best answers the question

### 4.3 DataEngineer Agent

The agent that does the actual data work:
- Reads the `DataEngineerConfig` (schema + semantic layer)
- Generates a safe, read-only SQL query
- Executes it against the user's Postgres DB (read-only connection)
- Returns structured results:
  - Raw tabular data (JSON)
  - XLSX spreadsheet (uploaded to S3, presigned URL returned)
  - Chart specification (chart type, axes, data — rendered frontend-side)

---

## 5. Feature Specifications

### 5.1 Database Connection Setup

**Endpoint**: `POST /de/connections`
**Auth**: User JWT

**Input**:
```json
{
  "name": "My Production DB",
  "host": "db.mycompany.com",
  "port": 5432,
  "database": "analytics",
  "username": "readonly_user",
  "password": "...",
  "ssl": true
}
```

**Flow**:
1. Validate connection (test connect, timeout 5s)
2. Encrypt credentials (AES-SIV, same pattern as existing `Database.py`)
3. Run schema introspection (see §5.2)
4. Generate DataEngineerConfig
5. Return `connection_id`

**Validation**:
- Test connection before saving
- Verify user has SELECT-only permissions (WARN if write permissions detected)
- Max 5 connections per user (configurable)

---

### 5.2 Schema Introspection

Runs automatically on first connect and can be manually refreshed.

**What it does**:
1. Query `information_schema` for all tables, columns, types, constraints
2. Detect foreign key relationships
3. Sample up to 3 rows from each table (for LLM context)
4. Estimate row counts via `pg_stat_user_tables`
5. Send schema to LLM → get:
   - Table/column descriptions in plain English
   - Business term mappings (semantic layer)
   - 5–10 suggested starter questions

**Endpoint**: `POST /de/connections/{connection_id}/refresh-schema`

---

### 5.3 Chat / Question Interface

**Endpoint**: `POST /de/connections/{connection_id}/ask`
**Transport**: REST (initial) + WebSocket (streaming steps)

**Input**:
```json
{
  "question": "What is my total revenue per product category this quarter?",
  "session_id": "uuid"  // optional, for conversation continuity
}
```

**SuperAgent Flow**:
```
1. Receive question
2. Load DataEngineerConfig for this connection
3. PLAN: Is this one query or multiple?
4. For each sub-query:
   a. Generate SQL (DataEngineer Agent)
   b. Execute SQL (read-only)
   c. Format results
5. COMBINE: Merge results if multi-query
6. DECIDE: What chart type best represents this data?
7. RETURN: table + sheet URL + chart spec
```

**Output**:
```json
{
  "run_id": "uuid",
  "question": "...",
  "answer_text": "Here is total revenue by product category for Q1 2026...",
  "queries_executed": [
    {
      "sql": "SELECT category, SUM(total) as revenue FROM orders JOIN products...",
      "rows_returned": 12,
      "execution_time_ms": 340
    }
  ],
  "table": {
    "columns": ["category", "revenue"],
    "rows": [["Electronics", 142000], ["Clothing", 98000], ...]
  },
  "sheet": {
    "download_url": "https://s3.../presigned...",
    "expires_in": 3600
  },
  "chart": {
    "type": "bar",  // bar | line | pie | scatter | area | heatmap
    "title": "Revenue by Category — Q1 2026",
    "x_axis": {"key": "category", "label": "Product Category"},
    "y_axis": {"key": "revenue", "label": "Revenue ($)"},
    "data": [...]
  }
}
```

---

### 5.4 Streaming Steps (WebSocket)

Real-time execution updates streamed to frontend while the agent works.

**Events**:
```
step: { type: "planning",     message: "Analyzing your question..." }
step: { type: "sql_generated", sql: "SELECT ..." }
step: { type: "executing",    message: "Running query against your database..." }
step: { type: "formatting",   message: "Building chart and spreadsheet..." }
step: { type: "done",         result: { ... } }
```

---

### 5.5 Session History

Users can revisit past questions and results.

**Endpoints**:
- `GET /de/sessions` — list sessions for user
- `GET /de/sessions/{session_id}` — session detail with all Q&A turns
- `GET /de/runs/{run_id}` — specific run detail (question, SQL, result, chart spec)

---

### 5.6 Chart Types Supported

| Chart Type | When Used |
|------------|-----------|
| Bar        | Categorical comparisons (revenue by category) |
| Line       | Time series trends (users over time) |
| Pie/Donut  | Share/proportion (% of revenue by region) |
| Area       | Cumulative trends |
| Scatter    | Correlation between two numeric measures |
| Heatmap    | Two-dimensional frequency (day × hour activity) |
| Table      | Always shown as fallback / alongside charts |

The SuperAgent decides chart type from query result shape and user question intent.

---

### 5.7 Spreadsheet Export

- Generated using `openpyxl` (already in requirements)
- Includes: data sheet + metadata sheet (question, SQL, timestamp)
- Uploaded to S3 via existing `S3Service`
- Presigned URL returned (expires 1 hour)

---

## 6. DataEngineer Agent — Detailed Design

### 6.1 Agent Config (`DataEngineerAgentConfig`)

Analogous to `trucible_config.py` in the existing codebase:

```python
{
  "name": "data_engineer",
  "description": "Generates and executes SQL queries on user's PostgreSQL database",
  "system_prompt": """
    You are a senior data engineer. You have access to the following database schema:
    {schema_context}

    Semantic layer (business term definitions):
    {semantic_layer}

    Rules:
    - ONLY generate SELECT queries (never INSERT, UPDATE, DELETE, DROP, etc.)
    - Always add LIMIT 10000 unless user asks for aggregations
    - Prefer CTEs for complex queries
    - Always alias column names to be human-readable
    - When filtering dates, use parameterized inputs, not string interpolation
  """,
  "actions": ["generate_sql", "execute_sql", "format_table", "generate_chart_spec", "export_sheet"],
  "max_retries": 2,  // retry SQL on execution error with error feedback
  "read_only": true
}
```

### 6.2 SQL Safety Rules

- Query is parsed before execution
- Blocklist: `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, `CREATE`, `ALTER`, `GRANT`, `REVOKE`, `EXECUTE`, `COPY`, `pg_exec`, `lo_export`
- Query executed via read-only connection pool
- Statement timeout: 30 seconds
- Result row limit: 10,000 rows

### 6.3 AI DAO for DataEngineer

New AI DAO: `AIDaoDataEngineerConfig`

```python
class AIDaoDataEngineerConfig:
    """
    Fetches DataEngineerConfig for a given connection_id.
    Used by DataEngineer agent to get schema context.
    """
    def get_schema_context(self, connection_id: str) -> dict
    def get_semantic_layer(self, connection_id: str) -> dict
    def get_sample_rows(self, connection_id: str, table: str) -> list
```

---

## 7. Database Schema (App DB)

New tables added to the app's PostgreSQL:

```sql
-- User database connections (credentials encrypted)
CREATE TABLE de_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    host TEXT NOT NULL,          -- encrypted
    port INTEGER NOT NULL,
    database TEXT NOT NULL,
    username TEXT NOT NULL,       -- encrypted
    password TEXT NOT NULL,       -- encrypted
    ssl BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'active', -- active | error | disconnected
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_connected_at TIMESTAMPTZ
);

-- Auto-generated schema snapshots
CREATE TABLE de_schema_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID REFERENCES de_connections(id),
    schema_json JSONB NOT NULL,   -- full DataEngineerConfig schema_snapshot
    semantic_layer JSONB,          -- business terms + suggested questions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_current BOOLEAN DEFAULT true
);

-- Chat sessions
CREATE TABLE de_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    connection_id UUID REFERENCES de_connections(id),
    title TEXT,                    -- auto-generated from first question
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual Q&A runs
CREATE TABLE de_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES de_sessions(id),
    connection_id UUID REFERENCES de_connections(id),
    question TEXT NOT NULL,
    answer_text TEXT,
    queries_executed JSONB,        -- [{sql, rows_returned, execution_time_ms}]
    table_data JSONB,              -- {columns, rows}
    chart_spec JSONB,              -- {type, title, x_axis, y_axis, data}
    sheet_s3_key TEXT,             -- S3 key for xlsx
    status TEXT DEFAULT 'pending', -- pending | running | done | error
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

---

## 8. Frontend Specification

### 8.1 Pages / Views

```
/                    → Landing / Connect DB
/connections         → List of user's connected DBs
/connections/new     → DB connection wizard
/chat/{conn_id}      → Chat interface for a connection
/history             → All past sessions
/session/{sess_id}   → Session replay
```

### 8.2 DB Connection Wizard

- Step 1: Choose input method — connection string OR individual fields
- Step 2: Fill credentials (host, port, db, user, pass, ssl toggle)
- Step 3: Test connection → show success/error feedback
- Step 4: Watch schema introspection progress (streaming steps)
- Step 5: Show schema summary + suggested questions → "Start Asking"

### 8.3 Chat Interface

Layout:
```
┌──────────────────────────────────────────────┐
│  [DB Name]  [Refresh Schema]  [Settings]      │
├───────────────────────┬──────────────────────┤
│                       │                      │
│  Conversation Panel   │  Results Panel       │
│  ─────────────────    │  ─────────────────   │
│  Q: "Revenue by       │  [Table View]        │
│     category?"        │  [Chart View]        │
│                       │  [Download .xlsx]    │
│  Thinking...          │                      │
│  ✓ SQL Generated      │  Bar Chart:          │
│  ✓ Query ran (340ms)  │  Revenue by Category │
│  ✓ Chart ready        │  [chart rendered]    │
│                       │                      │
│  [Ask another...]     │                      │
└───────────────────────┴──────────────────────┘
```

### 8.4 Results Viewer

Three tabs per result:
1. **Table** — paginated data table (client-side pagination of up to 10K rows)
2. **Chart** — rendered chart (Recharts or Chart.js), switchable chart type
3. **SQL** — the actual SQL that ran (collapsed by default, expandable)

Download options:
- `.xlsx` — full dataset with metadata sheet
- `.csv` — raw data only
- `.png` — chart image (client-side canvas capture)

---

## 9. API Reference

### Connections

| Method | Path | Description |
|--------|------|-------------|
| POST | `/de/connections` | Create a new DB connection |
| GET | `/de/connections` | List user's connections |
| GET | `/de/connections/{id}` | Connection detail + schema summary |
| DELETE | `/de/connections/{id}` | Remove connection |
| POST | `/de/connections/{id}/refresh-schema` | Re-introspect schema |
| GET | `/de/connections/{id}/schema` | Full schema snapshot |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/de/connections/{id}/ask` | Ask a question |
| GET | `/de/sessions` | List user's sessions |
| GET | `/de/sessions/{id}` | Session with all runs |
| GET | `/de/runs/{id}` | Single run detail |
| GET | `/de/runs/{id}/download` | Presigned S3 URL for .xlsx |

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/de/health` | Service health |
| GET | `/de/connections/{id}/test` | Test a saved connection |

---

## 10. Security Considerations

- All DB credentials encrypted at rest (AES-SIV, same as existing pattern)
- Read-only connections enforced via SQL blocklist + Postgres role recommendation
- Statement timeout (30s) prevents runaway queries
- Row limit (10K) prevents data exfiltration via large dumps
- JWT auth on all endpoints
- Connection credentials never returned in API responses after creation
- User can only access their own connections/sessions (tenant isolation)
- Schema snapshots stored in app DB, not the user's DB

---

## 11. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Python / Flask | Existing framework |
| LLM | OpenAI GPT-4o | SQL generation + semantic layer |
| ORM | Peewee | Existing pattern |
| User DB client | psycopg2 | Direct Postgres connections |
| Spreadsheet | openpyxl | Already in requirements |
| Charts | Frontend-side (Recharts) | Backend returns chart spec only |
| File storage | AWS S3 | Existing S3Service |
| Auth | JWT | Existing middleware |
| Real-time | Flask-SocketIO | Existing WebSocket infrastructure |
| Frontend | React + TypeScript | To be built |
| Styling | Tailwind CSS | To be decided |

---

## 12. What Is NOT In Scope (v1)

- MySQL, SQLite, other databases (Postgres only)
- Write operations (INSERT/UPDATE/DELETE via agent)
- Scheduled/recurring queries (cron jobs on user data)
- Data transformations or ETL pipelines
- Multi-tenant enterprise features beyond basic user isolation
- Column-level permissions / row-level security passthrough
- Saved queries / bookmarks (v2)
- Sharing results with teammates (v2)
- Alerting on data conditions (v2)

---

## 13. Open Questions

1. Should schema introspection be incremental (only re-scan changed tables) or always full?
2. What is the max question length? Should we support multi-turn refinement ("filter that by Q1 only")?
3. Should suggested questions be regenerated as the user's schema changes?
4. Do we want a "explain this SQL" button in the results panel?
5. How do we handle very large schemas (500+ tables)? Need table relevance ranking.

---

## 14. Implementation Phases

### Phase 1 — Core Backend
- [ ] DB connection model + encrypted storage
- [ ] Schema introspection service
- [ ] DataEngineerConfig generation (schema + semantic layer via LLM)
- [ ] DataEngineer agent (SQL gen + execution + safety)
- [ ] SuperAgent routing to DataEngineer
- [ ] Spreadsheet export (openpyxl → S3)
- [ ] Chart spec generation
- [ ] REST endpoints

### Phase 2 — Streaming + Frontend
- [ ] WebSocket step streaming
- [ ] React frontend: DB connection wizard
- [ ] React frontend: Chat interface
- [ ] React frontend: Results viewer (table + chart + download)
- [ ] Session history

### Phase 3 — Polish
- [ ] Schema refresh
- [ ] Multi-turn conversation (follow-up questions use prior SQL context)
- [ ] Suggested questions on new connection
- [ ] SQL retry on error with LLM self-correction
- [ ] Usage analytics

---

*This spec is a living document. Update as design decisions are made.*
