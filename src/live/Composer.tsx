import { useState, type FormEvent } from 'react'

// The server's limit (backend: chat CHAT_MAX_LENGTH).
export const CHAT_MAX_LENGTH = 200

interface ComposerProps {
  /** Signed in on this page; otherwise tapping it asks them to. */
  canChat: boolean
  mute: { until: Date | null } | null
  onSend(text: string): Promise<string | null>
  onLocked(): void
}

export function Composer({ canChat, mute, onSend, onLocked }: ComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!canChat) {
    return (
      <button type="button" className="composer composer-locked" onClick={onLocked}>
        Say something…
      </button>
    )
  }

  if (mute) {
    return (
      <p className="composer composer-muted" role="status">
        {mute.until
          ? `You're muted in this chat until ${mute.until.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
          : "You're muted in this chat."}
      </p>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const message = text.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    const failure = await onSend(message)
    setSending(false)
    if (failure) setError(failure)
    else setText('')
  }

  return (
    <form className="composer composer-form" onSubmit={(event) => void submit(event)}>
      <input
        className="composer-input"
        value={text}
        maxLength={CHAT_MAX_LENGTH}
        placeholder="Say something…"
        aria-label="Chat message"
        enterKeyHint="send"
        autoComplete="off"
        onChange={(event) => {
          setText(event.target.value)
          setError(null)
        }}
      />
      <button type="submit" className="btn btn-small btn-primary" disabled={sending || !text.trim()}>
        Send
      </button>
      {error && (
        <p className="composer-error" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}
