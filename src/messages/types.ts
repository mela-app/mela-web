import type { Person } from '../live/types'

/** Direct messages between friends (backend: direct-messages, docs/features/messages.md). */
export interface DirectMessage {
  id: string
  senderId: string
  recipientId: string
  text: string
  clientId: string | null
  createdAt: string
  readAt: string | null
}

export interface Conversation {
  user: Person
  lastMessage: DirectMessage | null
  unreadCount: number
  // They follow each other right now; otherwise the history stays but nothing new can be sent.
  canMessage: boolean
}

export interface ConversationPage {
  items: Conversation[]
  hasMore: boolean
  nextCursor: string | null
}

/** Oldest first. */
export interface ConversationHistory {
  user: Person
  canMessage: boolean
  messages: DirectMessage[]
  hasEarlier: boolean
}

export interface FriendsPage {
  items: Person[]
  hasMore: boolean
  nextCursor: string | null
}

/** What the account's realtime connection says about its messages. */
export type InboxEvent =
  | { type: 'new'; message: DirectMessage; sender: Person; recipient: Person }
  | { type: 'read'; readerId: string; partnerId: string; readAt: string }
  | { type: 'unreadCount'; count: number }
  // Mela's safety team removed a reported message - from both people's conversation.
  | { type: 'deleted'; messageId: string; senderId: string; recipientId: string }
  // (Re)connected: anything that came while it was down has to be fetched.
  | { type: 'connected' }
