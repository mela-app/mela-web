import { useEffect, useState } from 'react'
import type { WebSession } from '../lib/session'
import type { InboxEvents } from './events'
import { messagesApi } from './messagesApi'

/**
 * Unread direct messages - the Inbox button's badge. Fetched when signed in
 * and on every reconnect; in between, the server sends the new total.
 */
export function useUnreadMessages(session: WebSession, signedIn: boolean, events: InboxEvents): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    const refresh = () => {
      messagesApi.unreadCount(session).then(
        (next) => {
          if (!cancelled) setCount(next)
        },
        () => undefined,
      )
    }
    refresh()
    const unsubscribe = events.subscribe((event) => {
      if (event.type === 'unreadCount') setCount(event.count)
      else if (event.type === 'connected') refresh()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [session, signedIn, events])
  return signedIn ? count : 0
}
