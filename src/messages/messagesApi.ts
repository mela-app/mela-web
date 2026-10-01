import { api, ApiError } from '../lib/api'
import type { WebSession } from '../lib/session'
import type { ConversationHistory, ConversationPage, DirectMessage, FriendsPage } from './types'

const conversation = (userId: string) => `/v1/me/conversations/${encodeURIComponent(userId)}`
const cursorQuery = (name: string, value?: string) => (value ? `?${name}=${encodeURIComponent(value)}` : '')

async function token(session: WebSession): Promise<string> {
  const current = await session.token()
  if (!current) throw new ApiError(401, 'Log in to see your messages.')
  return current
}

/** The signed-in account's direct messages (backend: /v1/me/conversations). */
export const messagesApi = {
  async conversations(session: WebSession, cursor?: string): Promise<ConversationPage> {
    return api(`/v1/me/conversations${cursorQuery('cursor', cursor)}`, { token: await token(session) })
  },

  async unreadCount(session: WebSession): Promise<number> {
    const { count } = await api<{ count: number }>('/v1/me/conversations/unread-count', { token: await token(session) })
    return count
  },

  async history(session: WebSession, userId: string, before?: string): Promise<ConversationHistory> {
    return api(`${conversation(userId)}/messages${cursorQuery('before', before)}`, { token: await token(session) })
  },

  /** Safe to repeat with the same clientId: the server answers with the message it already stored. */
  async send(session: WebSession, userId: string, text: string, clientId: string): Promise<DirectMessage> {
    return api(`${conversation(userId)}/messages`, {
      method: 'POST',
      token: await token(session),
      body: { text, clientId },
    })
  },

  async markRead(session: WebSession, userId: string): Promise<void> {
    await api(`${conversation(userId)}/read`, { method: 'POST', token: await token(session) })
  },

  /** People who follow each other with this account - the only ones it can message. */
  async friends(session: WebSession, cursor?: string): Promise<FriendsPage> {
    return api(`/v1/users/me/friends${cursorQuery('cursor', cursor)}`, { token: await token(session) })
  },
}
