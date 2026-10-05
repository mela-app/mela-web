import type { AdminAlert, ChatMessage, Guest, GuestPlacement, PinnedMessage, RoomState, WatchResponse } from './types'

// A long live's older messages drop off; the page shows what's on now.
export const MAX_MESSAGES = 100

export type Phase = 'loading' | 'live' | 'ended' | 'banned' | 'error'

export interface LiveState {
  phase: Phase
  error: string | null
  watch: WatchResponse | null
  viewerCount: number
  likeCount: number
  paused: boolean
  hostAway: boolean
  moderatorIds: string[]
  messages: ChatMessage[]
  pinned: PinnedMessage | null
  guests: Guest[]
  isFollowingHost: boolean
  /** Muted in this live's chat: until when, or null for the rest of it. */
  chatMute: { until: Date | null } | null
  /** `reason` on stream_ended (backend StreamEndReason); null when it was over before we came. */
  endedReason: string | null
  /** An administrator's own words, when they stopped it. */
  endedMessage: string | null
  alert: AdminAlert | null
}

export type LiveAction =
  | { type: 'watching'; watch: WatchResponse }
  | { type: 'failed'; error: string }
  | { type: 'retry' }
  | { type: 'room'; state: RoomState }
  | { type: 'chatSnapshot'; messages: ChatMessage[] }
  | { type: 'chatNew'; message: ChatMessage }
  | { type: 'chatDeleted'; messageId: string }
  | { type: 'pinned'; pinned: PinnedMessage | null }
  | { type: 'viewers'; count: number }
  | { type: 'likes'; total: number }
  | { type: 'paused'; paused: boolean }
  | { type: 'hostAway'; away: boolean }
  | { type: 'moderators'; ids: string[] }
  | { type: 'guestJoined'; guest: Guest }
  | { type: 'guestLeft'; userId: string }
  | { type: 'guestPlaced'; userId: string; placement: GuestPlacement | null }
  | { type: 'following'; following: boolean }
  | { type: 'chatMuted'; until: Date | null }
  | { type: 'chatUnmuted' }
  | { type: 'alert'; alert: AdminAlert | null }
  | { type: 'ended'; reason: string | null; message: string | null }
  | { type: 'banned' }

export const initialLiveState: LiveState = {
  phase: 'loading',
  error: null,
  watch: null,
  viewerCount: 0,
  likeCount: 0,
  paused: false,
  hostAway: false,
  moderatorIds: [],
  messages: [],
  pinned: null,
  guests: [],
  isFollowingHost: false,
  chatMute: null,
  endedReason: null,
  endedMessage: null,
  alert: null,
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'watching':
      return {
        ...state,
        phase: 'live',
        error: null,
        watch: action.watch,
        pinned: action.watch.pinnedMessage,
        guests: action.watch.activeGuests,
        isFollowingHost: action.watch.isFollowingHost,
      }
    case 'failed':
      return { ...state, phase: 'error', error: action.error }
    case 'retry':
      return { ...state, phase: 'loading', error: null }
    case 'room':
      return {
        ...state,
        viewerCount: action.state.viewerCount,
        likeCount: action.state.likeCount,
        paused: action.state.paused,
        hostAway: action.state.hostAway,
        moderatorIds: action.state.moderatorIds,
      }
    case 'chatSnapshot':
      return { ...state, messages: action.messages.slice(-MAX_MESSAGES) }
    case 'chatNew':
      if (state.messages.some((message) => message.id === action.message.id)) return state
      return { ...state, messages: [...state.messages, action.message].slice(-MAX_MESSAGES) }
    case 'chatDeleted':
      return {
        ...state,
        messages: state.messages.filter((message) => message.id !== action.messageId),
        pinned: state.pinned?.id === action.messageId ? null : state.pinned,
      }
    case 'pinned':
      return { ...state, pinned: action.pinned }
    case 'viewers':
      return { ...state, viewerCount: action.count }
    case 'likes':
      return { ...state, likeCount: Math.max(state.likeCount, action.total) }
    case 'paused':
      return { ...state, paused: action.paused }
    case 'hostAway':
      return { ...state, hostAway: action.away }
    case 'moderators':
      return { ...state, moderatorIds: action.ids }
    case 'guestJoined':
      return { ...state, guests: [...state.guests.filter((guest) => guest.id !== action.guest.id), action.guest] }
    case 'guestLeft':
      return { ...state, guests: state.guests.filter((guest) => guest.id !== action.userId) }
    case 'guestPlaced':
      return {
        ...state,
        guests: state.guests.map((guest) =>
          guest.id === action.userId ? { ...guest, placement: action.placement } : guest,
        ),
      }
    case 'following':
      return { ...state, isFollowingHost: action.following }
    case 'chatMuted':
      return { ...state, chatMute: { until: action.until } }
    case 'chatUnmuted':
      return { ...state, chatMute: null }
    case 'alert':
      return { ...state, alert: action.alert }
    case 'ended':
      return { ...state, phase: 'ended', endedReason: action.reason, endedMessage: action.message }
    case 'banned':
      return { ...state, phase: 'banned' }
  }
}
