import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { BackIcon, EditIcon } from '../components/Icons'
import { ApiError } from '../lib/api'
import { compactCount, messageTime, shortTime } from '../lib/format'
import type { WebSession, WebUser } from '../lib/session'
import type { Person } from '../live/types'
import type { InboxEvents } from './events'
import { messagesApi } from './messagesApi'
import type { Conversation, DirectMessage } from './types'

// The server's limit (backend: DIRECT_MESSAGE_MAX_LENGTH).
export const MESSAGE_MAX_LENGTH = 1000
// A gap this long between two messages shows the time again.
const TIME_GAP_MS = 30 * 60_000
// Within this many pixels of the bottom still counts as reading the newest.
const STICK_THRESHOLD = 48

interface InboxProps {
  session: WebSession
  self: WebUser
  events: InboxEvents
}

type View = { name: 'list' } | { name: 'friends' } | { name: 'conversation'; person: Person }

/**
 * Direct messages on the web (docs/features/messages.md): the inbox, a
 * friend to write to, and a conversation - the same as the app's Inbox tab.
 */
export function Inbox({ session, self, events }: InboxProps) {
  const [view, setView] = useState<View>({ name: 'list' })
  const toList = useCallback(() => setView({ name: 'list' }), [])
  const open = useCallback((person: Person) => setView({ name: 'conversation', person }), [])

  if (view.name === 'friends') return <FriendPicker session={session} onBack={toList} onPick={open} />
  if (view.name === 'conversation') {
    return (
      <ConversationView
        key={view.person.id}
        session={session}
        self={self}
        events={events}
        person={view.person}
        onBack={toList}
      />
    )
  }
  return (
    <ConversationList
      session={session}
      self={self}
      events={events}
      onOpen={open}
      onNew={() => setView({ name: 'friends' })}
    />
  )
}

function ConversationList(props: InboxProps & { onOpen(person: Person): void; onNew(): void }) {
  const { session, self, events, onOpen, onNew } = props
  const [items, setItems] = useState<Conversation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  // Bumped to load the first page again: a retry, or a reconnect.
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    messagesApi.conversations(session).then(
      (page) => {
        if (cancelled) return
        setItems(page.items)
        setCursor(page.hasMore ? page.nextCursor : null)
        setError(null)
      },
      (caught: unknown) => {
        if (!cancelled) setError(errorText(caught))
      },
    )
    return () => {
      cancelled = true
    }
  }, [session, reloads])

  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type === 'connected') {
          setReloads((count) => count + 1)
        } else if (event.type === 'new') {
          const incoming = event.message.senderId !== self.id
          const partner = incoming ? event.sender : event.recipient
          setItems((current) => {
            if (!current) return current
            const unread = current.find((item) => item.user.id === partner.id)?.unreadCount ?? 0
            // Only friends can send, so a new message means they still are.
            const moved: Conversation = {
              user: partner,
              lastMessage: event.message,
              unreadCount: incoming ? unread + 1 : unread,
              canMessage: true,
            }
            return [moved, ...current.filter((item) => item.user.id !== partner.id)]
          })
        } else if (event.type === 'read') {
          setItems(
            (current) =>
              current?.map((item) => {
                // Read here or on another device.
                if (event.readerId === self.id && item.user.id === event.partnerId) return { ...item, unreadCount: 0 }
                const last = item.lastMessage
                if (event.partnerId === self.id && item.user.id === event.readerId && last?.senderId === self.id && !last.readAt) {
                  return { ...item, lastMessage: { ...last, readAt: event.readAt } }
                }
                return item
              }) ?? current,
          )
        } else if (event.type === 'deleted') {
          // Maybe a conversation's last message, or its only one.
          setReloads((count) => count + 1)
        }
      }),
    [events, self.id],
  )

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await messagesApi.conversations(session, cursor)
      setItems((current) => {
        const shown = new Set((current ?? []).map((item) => item.user.id))
        return [...(current ?? []), ...page.items.filter((item) => !shown.has(item.user.id))]
      })
      setCursor(page.hasMore ? page.nextCursor : null)
    } catch {
      // The button stays for another try.
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="inbox">
      <header className="inbox-header">
        <h2 id="inbox-title">Inbox</h2>
        <button type="button" className="btn btn-small btn-primary" onClick={onNew}>
          <EditIcon width={16} height={16} />
          New message
        </button>
      </header>
      <div className="inbox-scroll">
        {items === null && !error && (
          <p className="inbox-empty" role="status">
            Loading…
          </p>
        )}
        {items === null && error && (
          <Problem title="Couldn't load your messages" text={error} onRetry={() => setReloads((count) => count + 1)} />
        )}
        {items?.length === 0 && (
          <div className="inbox-empty">
            <strong>No messages yet</strong>
            Message a friend - someone you follow who follows you back.
          </div>
        )}
        {items && items.length > 0 && (
          <ul className="inbox-rows">
            {items.map((item) => (
              <li key={item.user.id}>
                <ConversationRow item={item} selfId={self.id} onOpen={() => onOpen(item.user)} />
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <div className="inbox-more">
            <button type="button" className="btn btn-small btn-quiet" disabled={loadingMore} onClick={() => void loadMore()}>
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ConversationRow({ item, selfId, onOpen }: { item: Conversation; selfId: string; onOpen(): void }) {
  const last = item.lastMessage
  const unread = item.unreadCount > 0
  return (
    <button type="button" className={unread ? 'inbox-row unread' : 'inbox-row'} onClick={onOpen}>
      <Avatar person={item.user} size="md" />
      <span className="inbox-row-main">
        <span className="inbox-row-name">{item.user.displayName}</span>
        <span className="inbox-row-preview">{last ? (last.senderId === selfId ? `You: ${last.text}` : last.text) : ''}</span>
      </span>
      <span className="inbox-row-side">
        {last && <time dateTime={last.createdAt}>{shortTime(last.createdAt)}</time>}
        {unread && (
          <span className="inbox-unread">
            {compactCount(item.unreadCount)}
            <span className="visually-hidden"> unread</span>
          </span>
        )}
      </span>
    </button>
  )
}

function FriendPicker({ session, onBack, onPick }: { session: WebSession; onBack(): void; onPick(person: Person): void }) {
  const [friends, setFriends] = useState<Person[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [reloads, setReloads] = useState(0)

  useEffect(() => {
    let cancelled = false
    messagesApi.friends(session).then(
      (page) => {
        if (cancelled) return
        setFriends(page.items)
        setCursor(page.hasMore ? page.nextCursor : null)
        setError(null)
      },
      (caught: unknown) => {
        if (!cancelled) setError(errorText(caught))
      },
    )
    return () => {
      cancelled = true
    }
  }, [session, reloads])

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await messagesApi.friends(session, cursor)
      setFriends((current) => [...(current ?? []), ...page.items])
      setCursor(page.hasMore ? page.nextCursor : null)
    } catch {
      // The button stays for another try.
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="inbox">
      <header className="inbox-header">
        <button type="button" className="icon-btn icon-btn-small" aria-label="Back to the inbox" onClick={onBack}>
          <BackIcon />
        </button>
        <h2 id="inbox-title">New message</h2>
      </header>
      <div className="inbox-scroll">
        <p className="inbox-hint">Friends - people you follow who follow you back</p>
        {friends === null && !error && (
          <p className="inbox-empty" role="status">
            Loading…
          </p>
        )}
        {friends === null && error && (
          <Problem title="Couldn't load your friends" text={error} onRetry={() => setReloads((count) => count + 1)} />
        )}
        {friends?.length === 0 && (
          <div className="inbox-empty">
            <strong>No friends yet</strong>
            When you and someone follow each other, you can message them.
          </div>
        )}
        {friends && friends.length > 0 && (
          <ul className="inbox-rows">
            {friends.map((friend) => (
              <li key={friend.id}>
                <button type="button" className="inbox-row" onClick={() => onPick(friend)}>
                  <Avatar person={friend} size="md" />
                  <span className="inbox-row-main">
                    <span className="inbox-row-name">{friend.displayName}</span>
                    <span className="inbox-row-preview">@{friend.username}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {cursor && (
          <div className="inbox-more">
            <button type="button" className="btn btn-small btn-quiet" disabled={loadingMore} onClick={() => void loadMore()}>
              Show more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

interface Pending {
  clientId: string
  text: string
  // Why it wasn't sent; it stays, to try again or remove.
  failure: string | null
}

function ConversationView(props: InboxProps & { person: Person; onBack(): void }) {
  const { session, self, events, person, onBack } = props
  const [who, setWho] = useState(person)
  const [messages, setMessages] = useState<DirectMessage[] | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [canMessage, setCanMessage] = useState(true)
  const [hasEarlier, setHasEarlier] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [text, setText] = useState('')
  // Bumped to load the latest page again: a retry, or a reconnect.
  const [reloads, setReloads] = useState(0)
  const shown = useRef<DirectMessage[] | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const atBottom = useRef(true)
  // After older messages go on top: how far from the bottom the reader was.
  const keepOffset = useRef<number | null>(null)

  useEffect(() => {
    shown.current = messages
  })

  // What they sent is read once it's on screen - not while the tab is in the background.
  const readIfVisible = useCallback(
    (messagesNow: DirectMessage[] | null) => {
      if (document.visibilityState !== 'visible') return
      if (!messagesNow?.some((message) => message.senderId === person.id && !message.readAt)) return
      messagesApi.markRead(session, person.id).catch(() => undefined)
      const now = new Date().toISOString()
      setMessages(
        (current) =>
          current?.map((message) => (message.senderId === person.id && !message.readAt ? { ...message, readAt: now } : message)) ??
          current,
      )
    },
    [session, person.id],
  )

  const add = useCallback((message: DirectMessage) => {
    // The send answer and the realtime echo both bring it; the first one wins.
    setMessages((current) => {
      if (!current || current.some((each) => each.id === message.id)) return current
      // Ids are time-ordered, so one arriving late still lands in its place.
      return [...current, message].sort((a, b) => (a.id < b.id ? -1 : 1))
    })
    if (message.clientId) setPending((current) => current.filter((item) => item.clientId !== message.clientId))
  }, [])

  const markSeen = useCallback((senderId: string, readAt: string) => {
    setMessages(
      (current) =>
        current?.map((message) =>
          message.senderId === senderId && !message.readAt && message.createdAt <= readAt ? { ...message, readAt } : message,
        ) ?? current,
    )
  }, [])

  useEffect(() => {
    let cancelled = false
    messagesApi.history(session, person.id).then(
      (history) => {
        if (cancelled) return
        setWho(history.user)
        setCanMessage(history.canMessage)
        setMessages(history.messages)
        setHasEarlier(history.hasEarlier)
        // Stored after all, its answer lost with the connection.
        setPending((current) => current.filter((item) => !history.messages.some((message) => message.clientId === item.clientId)))
        setError(null)
        readIfVisible(history.messages)
      },
      (caught: unknown) => {
        if (!cancelled) setError(errorText(caught))
      },
    )
    return () => {
      cancelled = true
    }
  }, [session, person.id, reloads, readIfVisible])

  useEffect(
    () =>
      events.subscribe((event) => {
        if (event.type === 'connected') {
          setReloads((count) => count + 1)
        } else if (event.type === 'new') {
          const { message } = event
          const partnerId = message.senderId === self.id ? message.recipientId : message.senderId
          if (partnerId !== person.id) return
          add(message)
          if (message.senderId === person.id) {
            setCanMessage(true)
            readIfVisible([message])
          }
        } else if (event.type === 'read') {
          if (event.readerId === person.id && event.partnerId === self.id) markSeen(self.id, event.readAt)
          else if (event.readerId === self.id && event.partnerId === person.id) markSeen(person.id, event.readAt)
        } else if (event.type === 'deleted') {
          setMessages((current) => current?.filter((message) => message.id !== event.messageId) ?? current)
        }
      }),
    [events, self.id, person.id, add, markSeen, readIfVisible],
  )

  useEffect(() => {
    const onChange = () => readIfVisible(shown.current)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [readIfVisible])

  const loaded = messages !== null
  useEffect(() => {
    if (loaded) input.current?.focus()
  }, [loaded])

  useLayoutEffect(() => {
    const element = scroller.current
    if (!element) return
    if (keepOffset.current !== null) {
      element.scrollTop = element.scrollHeight - keepOffset.current
      keepOffset.current = null
    } else if (atBottom.current) {
      element.scrollTop = element.scrollHeight
    }
  }, [messages, pending])

  const deliver = useCallback(
    async (item: Pending) => {
      try {
        add(await messagesApi.send(session, person.id, item.text, item.clientId))
      } catch (caught) {
        if (caught instanceof ApiError && caught.code === 'NOT_FRIENDS') setCanMessage(false)
        const failure = failureText(caught)
        setPending((current) => current.map((each) => (each.clientId === item.clientId ? { ...each, failure } : each)))
      }
    },
    [session, person.id, add],
  )

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !canMessage) return
    const item: Pending = { clientId: crypto.randomUUID(), text: trimmed, failure: null }
    setPending((current) => [...current, item])
    setText('')
    atBottom.current = true
    void deliver(item)
  }

  // The same clientId: if the first try was stored after all, it isn't stored twice.
  const retry = (item: Pending) => {
    setPending((current) => current.map((each) => (each.clientId === item.clientId ? { ...each, failure: null } : each)))
    void deliver(item)
  }

  const remove = (item: Pending) => setPending((current) => current.filter((each) => each.clientId !== item.clientId))

  const loadEarlier = async () => {
    const oldest = messages?.[0]
    if (!oldest || loadingEarlier) return
    setLoadingEarlier(true)
    try {
      const history = await messagesApi.history(session, person.id, oldest.id)
      const element = scroller.current
      if (element) keepOffset.current = element.scrollHeight - element.scrollTop
      setMessages((current) => {
        const shown = new Set((current ?? []).map((message) => message.id))
        return [...history.messages.filter((message) => !shown.has(message.id)), ...(current ?? [])]
      })
      setHasEarlier(history.hasEarlier)
    } catch {
      // The button stays for another try.
    } finally {
      setLoadingEarlier(false)
    }
  }

  const newest = messages?.[messages.length - 1]
  return (
    <div className="inbox">
      <header className="inbox-header">
        <button type="button" className="icon-btn icon-btn-small" aria-label="Back to the inbox" onClick={onBack}>
          <BackIcon />
        </button>
        <Avatar person={who} size="sm" />
        <h2 id="inbox-title">{who.displayName}</h2>
      </header>
      <div
        ref={scroller}
        className="inbox-scroll"
        onScroll={(event) => {
          const element = event.currentTarget
          atBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD
        }}
      >
        {messages === null && !error && (
          <p className="inbox-empty" role="status">
            Loading…
          </p>
        )}
        {messages === null && error && (
          <Problem title="Couldn't load this conversation" text={error} onRetry={() => setReloads((count) => count + 1)} />
        )}
        {hasEarlier && (
          <div className="inbox-more">
            <button type="button" className="btn btn-small btn-quiet" disabled={loadingEarlier} onClick={() => void loadEarlier()}>
              Show earlier messages
            </button>
          </div>
        )}
        {messages?.length === 0 && pending.length === 0 && (
          <div className="inbox-empty">
            <strong>Say hi to {who.displayName}</strong>
            Messages here are just between the two of you.
          </div>
        )}
        {messages && (messages.length > 0 || pending.length > 0) && (
          <ol className="dm-list" aria-label={`Messages with ${who.displayName}`}>
            {messages.map((message, index) => {
              const previous = messages[index - 1]
              const mine = message.senderId === self.id
              const showTime = !previous || Date.parse(message.createdAt) - Date.parse(previous.createdAt) >= TIME_GAP_MS
              return (
                <li key={message.id} className={mine ? 'dm mine' : 'dm'}>
                  {showTime && <span className="dm-time">{messageTime(message.createdAt)}</span>}
                  <p className="dm-bubble">{message.text}</p>
                  {message === newest && mine && pending.length === 0 && (
                    <span className="dm-status">{message.readAt ? 'Seen' : 'Sent'}</span>
                  )}
                </li>
              )
            })}
            {pending.map((item) => (
              <li key={item.clientId} className={item.failure ? 'dm mine failed' : 'dm mine sending'}>
                <p className="dm-bubble">{item.text}</p>
                {item.failure ? (
                  <span className="dm-failure" role="alert">
                    {item.failure}
                    <span className="dm-actions">
                      <button type="button" className="dm-action" onClick={() => remove(item)}>
                        Remove
                      </button>
                      <button type="button" className="dm-action" onClick={() => retry(item)}>
                        Try again
                      </button>
                    </span>
                  </span>
                ) : (
                  <span className="dm-status">Sending…</span>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
      {messages !== null &&
        (canMessage ? (
          <form className="dm-composer" onSubmit={submit}>
            <input
              ref={input}
              value={text}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder="Message…"
              aria-label={`Message ${who.displayName}`}
              enterKeyHint="send"
              autoComplete="off"
              onChange={(event) => setText(event.target.value)}
            />
            <button type="submit" className="btn btn-small btn-primary" disabled={!text.trim()}>
              Send
            </button>
          </form>
        ) : (
          <p className="dm-locked">You can message each other again once you both follow each other.</p>
        ))}
    </div>
  )
}

function Problem({ title, text, onRetry }: { title: string; text: string; onRetry(): void }) {
  return (
    <div className="inbox-empty" role="alert">
      <strong>{title}</strong>
      {text}
      <button type="button" className="btn btn-small btn-quiet" onClick={onRetry}>
        Try again
      </button>
    </div>
  )
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong. Try again.'
}

function failureText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'NOT_FRIENDS') return "Not sent - you don't follow each other anymore."
    if (error.status === 429) return 'Not sent - slow down a little, then try again.'
    // Says what's wrong with it, e.g. a link to another site.
    if (error.status === 400) return error.message.endsWith('.') ? error.message : `${error.message}.`
  }
  return `Not sent. ${errorText(error)}`
}
