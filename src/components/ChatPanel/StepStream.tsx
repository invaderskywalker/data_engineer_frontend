import type { AgentStep } from '../../types'
import './StepStream.css'

function PlanningIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" />
      <path d="M8 5v3l2 1" strokeLinecap="round" />
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <polyline points="5 4 1 8 5 12" />
      <polyline points="11 4 15 8 11 12" />
      <line x1="9" y1="2" x2="7" y2="14" />
    </svg>
  )
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="8" cy="4" rx="6" ry="2" />
      <path d="M2 4v3c0 1.1 2.69 2 6 2s6-.9 6-2V4" />
      <path d="M2 7v3c0 1.1 2.69 2 6 2s6-.9 6-2V7" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="10" width="3" height="4" />
      <rect x="6" y="6" width="3" height="8" />
      <rect x="11" y="3" width="3" height="11" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <polyline points="3,8 6,11 13,4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <line x1="4" y1="4" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="12" y1="4" x2="4" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg className="step-stream__spinner" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="20" strokeDashoffset="6" />
    </svg>
  )
}

function getStepIcon(type: AgentStep['type'], isLast: boolean, isDone: boolean) {
  if (isDone && type !== 'error') return <CheckIcon />
  if (isLast && type === 'error') return <ErrorIcon />

  switch (type) {
    case 'planning': return <PlanningIcon />
    case 'sql_generated': return <CodeIcon />
    case 'executing': return <DatabaseIcon />
    case 'formatting': return <ChartIcon />
    case 'done': return <CheckIcon />
    case 'error': return <ErrorIcon />
    default: return <SpinnerIcon />
  }
}

function getStepLabel(type: AgentStep['type']): string {
  const labels: Record<AgentStep['type'], string> = {
    planning: 'Planning',
    sql_generated: 'SQL Generated',
    executing: 'Executing',
    formatting: 'Formatting',
    done: 'Complete',
    error: 'Error',
  }
  return labels[type] ?? type
}

interface StepStreamProps {
  steps: AgentStep[]
  isActive: boolean
}

export default function StepStream({ steps, isActive }: StepStreamProps) {
  if (steps.length === 0 && !isActive) return null

  return (
    <div className="step-stream">
      <div className="step-stream__timeline">
        {steps.map((step, i) => {
          const isLastStep = i === steps.length - 1
          const isDone = step.type === 'done'
          const isError = step.type === 'error'
          const isActiveStep = isLastStep && isActive && !isDone && !isError

          return (
            <div
              key={i}
              className={`step-stream__item ${isActiveStep ? 'step-stream__item--active' : ''} ${isDone ? 'step-stream__item--done' : ''} ${isError ? 'step-stream__item--error' : ''}`}
            >
              <div className="step-stream__icon-wrap">
                <div className={`step-stream__icon ${isActiveStep ? 'step-stream__icon--spinning' : ''}`}>
                  {isActiveStep
                    ? <SpinnerIcon />
                    : getStepIcon(step.type, isLastStep, !isActiveStep)
                  }
                </div>
                {i < steps.length - 1 && (
                  <div className="step-stream__connector" />
                )}
              </div>
              <div className="step-stream__content">
                <span className="step-stream__type">{getStepLabel(step.type)}</span>
                <span className="step-stream__message">{step.message}</span>
                {step.sql && (
                  <pre className="step-stream__sql">{step.sql}</pre>
                )}
              </div>
            </div>
          )
        })}

        {isActive && steps.length === 0 && (
          <div className="step-stream__item step-stream__item--active">
            <div className="step-stream__icon-wrap">
              <div className="step-stream__icon step-stream__icon--spinning">
                <SpinnerIcon />
              </div>
            </div>
            <div className="step-stream__content">
              <span className="step-stream__type">Starting</span>
              <span className="step-stream__message">Analyzing your question...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
