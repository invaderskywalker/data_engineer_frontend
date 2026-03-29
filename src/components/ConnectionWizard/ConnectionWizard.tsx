import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ConnectionFormData, SchemaSnapshot } from '../../types'
import { testConnectionData, createConnection } from '../../api/connections'
import Button from '../common/Button'
import './ConnectionWizard.css'

type WizardStep = 1 | 2 | 3 | 4

function parseConnectionString(cs: string): Partial<ConnectionFormData> {
  try {
    const match = cs.match(/postgresql:\/\/([^:]+):([^@]+)@([^:\/]+):?(\d*)\/([^?]+)/)
    if (!match) return {}
    const [, username, password, host, portStr, database] = match
    return {
      username,
      password,
      host,
      port: portStr ? parseInt(portStr, 10) : 5432,
      database,
      ssl: cs.includes('sslmode=require'),
    }
  } catch {
    return {}
  }
}

const SCHEMA_STEPS = [
  'Discovering tables and columns',
  'Detecting foreign key relationships',
  'Generating semantic descriptions',
  'Building query context',
  'Indexing for natural language search',
]

export default function ConnectionWizard() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>(1)
  const [inputMode, setInputMode] = useState<'string' | 'manual'>('string')
  const [connectionString, setConnectionString] = useState('')
  const [form, setForm] = useState<ConnectionFormData>({
    name: '',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
  })
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; table_count?: number } | null>(null)
  const [testing, setTesting] = useState(false)
  const [schemaProgress, setSchemaProgress] = useState(0)
  const [schema, setSchema] = useState<SchemaSnapshot | null>(null)
  const [createdConnectionId, setCreatedConnectionId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  function updateForm(field: keyof ConnectionFormData, value: string | number | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleParseConnectionString() {
    const parsed = parseConnectionString(connectionString)
    if (Object.keys(parsed).length === 0) {
      setFormError('Could not parse connection string. Please check the format.')
      return
    }
    setFormError(null)
    setForm(prev => ({
      ...prev,
      ...parsed,
      name: prev.name || parsed.database || '',
    }))
    setInputMode('manual')
  }

  async function handleTestAndProceed() {
    setTesting(true)
    setFormError(null)
    try {
      const data = inputMode === 'string'
        ? { ...parseConnectionString(connectionString), name: form.name } as ConnectionFormData
        : form
      const result = await testConnectionData(data)
      setTestResult(result)
      setStep(2)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  async function handleContinueFromTest() {
    setStep(3)
    // Simulate schema introspection progress
    for (let i = 1; i <= SCHEMA_STEPS.length; i++) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400))
      setSchemaProgress(i)
    }
    // Create the connection
    try {
      const data = inputMode === 'string'
        ? { ...parseConnectionString(connectionString), name: form.name || 'My Database' } as ConnectionFormData
        : form
      const conn = await createConnection(data)
      setCreatedConnectionId(conn.id)
      // Mock schema
      setSchema({
        tables: Array.from({ length: testResult?.table_count ?? 12 }, (_, i) => ({
          name: `table_${i + 1}`,
          columns: [],
          row_count_estimate: Math.floor(Math.random() * 100000),
          description: '',
        })),
        relationships: Array.from({ length: Math.floor((testResult?.table_count ?? 12) * 0.7) }, (_, i) => ({
          from: `table_${i + 1}.id`,
          to: `table_${i + 2}.ref_id`,
          type: 'many-to-one',
        })),
        suggested_questions: [
          'What is the total revenue this month?',
          'Show me the top 10 customers by value',
          'How many new users signed up this week?',
          'What are the most popular products?',
          'Show trends over the last 6 months',
        ],
      })
    } catch {
      // continue anyway in mock mode
    }
    setStep(4)
  }

  const totalSteps = 4
  const progress = ((step - 1) / (totalSteps - 1)) * 100

  return (
    <div className="wizard">
      <div className="wizard__card">
        {/* Header */}
        <div className="wizard__header">
          <div className="wizard__logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <ellipse cx="12" cy="5" rx="9" ry="3" />
              <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
              <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
              <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
            </svg>
          </div>
          <div className="wizard__title-group">
            <h1 className="wizard__title">Connect a Database</h1>
            <p className="wizard__subtitle">Step {step} of {totalSteps}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="wizard__progress-track">
          <div className="wizard__progress-fill" style={{ width: `${progress}%` }} />
        </div>

        {/* Step indicators */}
        <div className="wizard__steps">
          {(['Details', 'Test', 'Schema', 'Ready'] as const).map((label, i) => (
            <div
              key={label}
              className={`wizard__step-indicator ${step > i + 1 ? 'wizard__step-indicator--done' : step === i + 1 ? 'wizard__step-indicator--active' : ''}`}
            >
              <div className="wizard__step-dot">
                {step > i + 1 ? (
                  <svg viewBox="0 0 12 12" fill="none">
                    <polyline points="2,6 5,9 10,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              <span className="wizard__step-label">{label}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="wizard__body">
          {/* Step 1: Connection Details */}
          {step === 1 && (
            <div className="wizard__step-content" key="step1">
              <h2 className="wizard__step-title">Connection Details</h2>
              <p className="wizard__step-desc">
                Paste a connection string or fill in the details manually.
              </p>

              <div className="wizard__mode-toggle">
                <button
                  className={`wizard__mode-btn ${inputMode === 'string' ? 'wizard__mode-btn--active' : ''}`}
                  onClick={() => setInputMode('string')}
                >
                  Connection String
                </button>
                <button
                  className={`wizard__mode-btn ${inputMode === 'manual' ? 'wizard__mode-btn--active' : ''}`}
                  onClick={() => setInputMode('manual')}
                >
                  Manual Setup
                </button>
              </div>

              {inputMode === 'string' ? (
                <div className="wizard__form">
                  <div className="wizard__field">
                    <label className="wizard__label">Connection String</label>
                    <div className="wizard__field-row">
                      <textarea
                        className="wizard__textarea wizard__mono"
                        value={connectionString}
                        onChange={e => setConnectionString(e.target.value)}
                        placeholder="postgresql://user:password@host:5432/database"
                        rows={3}
                      />
                    </div>
                    <span className="wizard__hint">
                      Example: <code className="wizard__code">postgresql://app:secret@db.company.com:5432/mydb</code>
                    </span>
                  </div>
                  <div className="wizard__field">
                    <label className="wizard__label">Connection Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => updateForm('name', e.target.value)}
                      placeholder="e.g. Production DB"
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleParseConnectionString}
                    disabled={!connectionString.trim()}
                  >
                    Parse string
                  </Button>
                </div>
              ) : (
                <div className="wizard__form">
                  <div className="wizard__field">
                    <label className="wizard__label">Connection Name</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={e => updateForm('name', e.target.value)}
                      placeholder="e.g. Production DB"
                    />
                  </div>
                  <div className="wizard__field-grid">
                    <div className="wizard__field">
                      <label className="wizard__label">Host</label>
                      <input
                        type="text"
                        value={form.host}
                        onChange={e => updateForm('host', e.target.value)}
                        placeholder="db.example.com"
                      />
                    </div>
                    <div className="wizard__field wizard__field--narrow">
                      <label className="wizard__label">Port</label>
                      <input
                        type="number"
                        value={form.port}
                        onChange={e => updateForm('port', parseInt(e.target.value, 10) || 5432)}
                        placeholder="5432"
                      />
                    </div>
                  </div>
                  <div className="wizard__field">
                    <label className="wizard__label">Database</label>
                    <input
                      type="text"
                      value={form.database}
                      onChange={e => updateForm('database', e.target.value)}
                      placeholder="my_database"
                    />
                  </div>
                  <div className="wizard__field-grid">
                    <div className="wizard__field">
                      <label className="wizard__label">Username</label>
                      <input
                        type="text"
                        value={form.username}
                        onChange={e => updateForm('username', e.target.value)}
                        placeholder="postgres"
                      />
                    </div>
                    <div className="wizard__field">
                      <label className="wizard__label">Password</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={e => updateForm('password', e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div className="wizard__field wizard__field--row">
                    <label className="wizard__toggle">
                      <input
                        type="checkbox"
                        checked={form.ssl}
                        onChange={e => updateForm('ssl', e.target.checked)}
                      />
                      <span className="wizard__toggle-track" />
                      <span className="wizard__label wizard__label--inline">Require SSL</span>
                    </label>
                  </div>
                </div>
              )}

              {formError && (
                <div className="wizard__error">{formError}</div>
              )}

              <div className="wizard__actions">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => navigate('/connections')}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  loading={testing}
                  onClick={handleTestAndProceed}
                  disabled={inputMode === 'string' ? !connectionString.trim() && !form.host : !form.host || !form.database}
                >
                  Test Connection
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Test Result */}
          {step === 2 && (
            <div className="wizard__step-content" key="step2">
              <h2 className="wizard__step-title">Connection Test</h2>

              {testResult?.success ? (
                <div className="wizard__test-result wizard__test-result--success">
                  <div className="wizard__test-icon wizard__test-icon--success">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h3>Connected Successfully</h3>
                  <p>{testResult.message}</p>

                  <div className="wizard__test-meta">
                    <div className="wizard__test-meta-item">
                      <span className="wizard__test-meta-label">Database</span>
                      <span className="wizard__test-meta-value">{form.database || 'mydb'}</span>
                    </div>
                    <div className="wizard__test-meta-item">
                      <span className="wizard__test-meta-label">Host</span>
                      <span className="wizard__test-meta-value">{form.host || 'localhost'}</span>
                    </div>
                    {testResult.table_count !== undefined && (
                      <div className="wizard__test-meta-item">
                        <span className="wizard__test-meta-label">Tables found</span>
                        <span className="wizard__test-meta-value wizard__test-meta-value--accent">
                          {testResult.table_count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="wizard__test-result wizard__test-result--error">
                  <div className="wizard__test-icon wizard__test-icon--error">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </div>
                  <h3>Connection Failed</h3>
                  <p>{testResult?.message ?? 'Unknown error'}</p>
                </div>
              )}

              <div className="wizard__actions">
                <Button variant="ghost" size="md" onClick={() => setStep(1)}>
                  Back
                </Button>
                {testResult?.success && (
                  <Button variant="primary" size="md" onClick={handleContinueFromTest}>
                    Continue
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Schema Introspection */}
          {step === 3 && (
            <div className="wizard__step-content" key="step3">
              <h2 className="wizard__step-title">Reading Your Schema</h2>
              <p className="wizard__step-desc">
                Analyzing your database structure to enable natural language queries.
              </p>

              <div className="wizard__schema-steps">
                {SCHEMA_STEPS.map((label, i) => {
                  const done = schemaProgress > i
                  const active = schemaProgress === i
                  return (
                    <div
                      key={label}
                      className={`wizard__schema-step ${done ? 'wizard__schema-step--done' : active ? 'wizard__schema-step--active' : 'wizard__schema-step--pending'}`}
                    >
                      <div className="wizard__schema-step-icon">
                        {done ? (
                          <svg viewBox="0 0 16 16" fill="none">
                            <polyline points="3,8 6,11 13,4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        ) : active ? (
                          <svg className="wizard__schema-spinner" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20" strokeDashoffset="5" />
                          </svg>
                        ) : (
                          <span>{i + 1}</span>
                        )}
                      </div>
                      <span className="wizard__schema-step-label">{label}</span>
                    </div>
                  )
                })}
              </div>

              <div className="wizard__schema-progress">
                <div
                  className="wizard__schema-progress-fill"
                  style={{ width: `${(schemaProgress / SCHEMA_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 4: Ready */}
          {step === 4 && (
            <div className="wizard__step-content wizard__step-content--ready" key="step4">
              <div className="wizard__ready-icon">
                <svg viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" fill="var(--green-muted)" stroke="var(--green)" strokeWidth="2" />
                  <polyline points="14,24 20,30 34,16" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="wizard__step-title">Your Database is Ready!</h2>
              <p className="wizard__step-desc">
                Connected to <strong>{form.database || 'your database'}</strong> with{' '}
                <strong>{schema?.tables.length ?? 0} tables</strong> and{' '}
                <strong>{schema?.relationships.length ?? 0} relationships</strong> detected.
              </p>

              {schema && schema.suggested_questions.length > 0 && (
                <div className="wizard__suggestions">
                  <p className="wizard__suggestions-label">Try asking:</p>
                  <div className="wizard__suggestion-chips">
                    {schema.suggested_questions.slice(0, 5).map(q => (
                      <button
                        key={q}
                        className="wizard__suggestion-chip"
                        onClick={() => {
                          if (createdConnectionId) {
                            navigate(`/chat/${createdConnectionId}`, { state: { initialQuestion: q } })
                          }
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="wizard__actions wizard__actions--centered">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    if (createdConnectionId) {
                      navigate(`/chat/${createdConnectionId}`)
                    } else {
                      navigate('/connections')
                    }
                  }}
                >
                  Start Asking Questions
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
