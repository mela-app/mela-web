import { useLayoutEffect, useRef } from 'react'
import { PinIcon } from '../components/Icons'
import type { ChatMessage, PinnedMessage } from './types'

interface ChatListProps {
  messages: ChatMessage[]
  pinned: PinnedMessage | null
  hostId: string
  moderatorIds: string[]
  /** Over the video (phones) or in the side panel (computers). */
  variant: 'overlay' | 'panel'
}

// Within this many pixels of the bottom still counts as reading the newest.
const STICK_THRESHOLD = 48

/** The chat, newest at the bottom - kept there unless they've scrolled up to read. */
export function ChatList({ messages, pinned, hostId, moderatorIds, variant }: ChatListProps) {
  const list = useRef<HTMLOListElement>(null)
  const atBottom = useRef(true)

  useLayoutEffect(() => {
    const element = list.current
    if (element && atBottom.current) element.scrollTop = element.scrollHeight
  }, [messages])

  return (
    <div className={`chat chat-${variant}`}>
      {pinned && (
        <div className="chat-pinned">
          <PinIcon width={14} height={14} />
          <span>
            <strong>{pinned.senderName}</strong> {pinned.text}
          </span>
        </div>
      )}
      <ol
        ref={list}
        className="chat-list"
        role="log"
        aria-label="Live chat"
        onScroll={(event) => {
          const element = event.currentTarget
          atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD
        }}
      >
        {messages.length === 0 && variant === 'panel' && <li className="chat-empty">No messages yet.</li>}
        {messages.map((message) => (
          <li key={message.id} className="chat-line">
            <span className="chat-name">
              {message.sender.displayName}
              {message.sender.id === hostId ? (
                <span className="badge badge-host">HOST</span>
              ) : (
                moderatorIds.includes(message.sender.id) && <span className="badge badge-mod">MOD</span>
              )}
            </span>{' '}
            {message.imageUrl && isWebUrl(message.imageUrl) && (
              <a className="chat-photo" href={message.imageUrl} target="_blank" rel="noopener noreferrer">
                <img src={message.imageUrl} alt={`Photo from ${message.sender.displayName}`} loading="lazy" />
              </a>
            )}
            {message.text && <span className="chat-text">{message.text}</span>}
          </li>
        ))}
      </ol>
    </div>
  )
}

function isWebUrl(url: string): boolean {
  return url.startsWith('https://') || url.startsWith('http://')
}
