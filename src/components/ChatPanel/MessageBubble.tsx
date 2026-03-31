import './MessageBubble.css'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  isLoading?: boolean
  /** True while tokens are still streaming in — shows a blinking cursor */
  isStreaming?: boolean
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function MessageBubble({ role, content, timestamp, isLoading, isStreaming }: MessageBubbleProps) {
  return (
    <div className={`message-bubble message-bubble--${role}`}>
      {role === 'assistant' && (
        <div className="message-bubble__avatar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v4c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 9v4c0 1.66 4.03 3 9 3s9-1.34 9-3V9" />
            <path d="M3 13v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
          </svg>
        </div>
      )}
      <div className="message-bubble__body">
        <div className="message-bubble__bubble">
          {isLoading ? (
            <div className="message-bubble__typing">
              <span />
              <span />
              <span />
            </div>
          ) : (
            <p>
              {content}
              {isStreaming && <span className="message-bubble__cursor" />}
            </p>
          )}
        </div>
        {timestamp && !isLoading && !isStreaming && (
          <span className="message-bubble__time">{formatTime(timestamp)}</span>
        )}
      </div>
    </div>
  )
}
