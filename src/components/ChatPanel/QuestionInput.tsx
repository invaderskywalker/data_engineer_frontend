import { useRef, useEffect, KeyboardEvent } from 'react'
import './QuestionInput.css'

interface QuestionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

export default function QuestionInput({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Ask anything about your data...',
}: QuestionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const maxHeight = 5 * 24 + 24 // ~5 lines
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }, [value])

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim() && !disabled) {
        onSubmit()
      }
    }
  }

  return (
    <div className={`question-input ${disabled ? 'question-input--disabled' : ''}`}>
      <textarea
        ref={textareaRef}
        className="question-input__textarea"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
      />
      <div className="question-input__actions">
        <span className="question-input__hint">
          {disabled ? 'Waiting for response...' : 'Enter to send · Shift+Enter for newline'}
        </span>
        <button
          className={`question-input__send ${!value.trim() || disabled ? 'question-input__send--disabled' : ''}`}
          onClick={onSubmit}
          disabled={!value.trim() || disabled}
          title="Send message"
        >
          <svg viewBox="0 0 20 20" fill="none">
            <path
              d="M2.5 10L18 3L11 17.5L9 11L2.5 10Z"
              fill="currentColor"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
