/** Shapes of the API's watch data and realtime events (backend: streams, chat, realtime). */

export interface Person {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export type VideoCredentials =
  | { provider: 'AGORA'; appId: string; token: string; uid: number }
  | { provider: 'LIVEKIT'; url: string; token: string }

export interface StreamInfo {
  id: string
  title: string
  hostId: string
  host: Person
  channelName: string
}

/** Where the host put a guest's tile, as shares of the stage's guest area (docs/features/guests.md). */
export interface GuestPlacement {
  x: number
  y: number
  /** The tile's width as a share of the area's; tiles are 3:4 portrait. */
  size: number
}

export interface Guest extends Person {
  /** Agora only: how the video tells this guest apart. */
  agoraUid: number | null
  /** Null or missing: the automatic column. */
  placement?: GuestPlacement | null
}

export interface PinnedMessage {
  id: string
  text: string
  senderName: string
}

/** POST /v1/streams/:id/watch */
export interface WatchResponse {
  stream: StreamInfo
  rtcToken: VideoCredentials
  watchTicket: string
  isFollowingHost: boolean
  pinnedMessage: PinnedMessage | null
  activeGuests: Guest[]
  hostAgoraUid: number
}

export interface ChatMessage {
  id: string
  // With a photo, its caption - maybe empty.
  text: string
  // The host's photo.
  imageUrl?: string | null
  createdAt: string
  sender: Person
}

export interface RoomState {
  viewerCount: number
  hostAway: boolean
  paused: boolean
  likeCount: number
  moderatorIds: string[]
}

export interface AdminAlert {
  id: string
  message: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
  streamId?: string | null
}

export type Ack<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; retryAfterMs?: number }
