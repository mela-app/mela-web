import type { VideoCredentials } from '../live/types'

export type Fit = 'cover' | 'contain'

/** One person's video on screen. */
export interface VideoTile {
  /** Changes with the video track, so a republished one is shown afresh. */
  key: string
  isHost: boolean
  /** Who it is: LiveKit says (identity = user id); Agora gives a uid the caller maps. */
  userId?: string
  agoraUid?: number
  /** Shows the video inside [container]; the returned function takes it back out. */
  mount(container: HTMLElement, fit: Fit): () => void
}

export interface WatchOptions {
  credentials: VideoCredentials
  channelName: string
  hostId: string
  hostAgoraUid: number
  onTiles(tiles: VideoTile[]): void
  /** The browser holds sound back until the viewer taps the page. */
  onAudioBlocked(blocked: boolean): void
  /** The browser's local media connection is degraded or recovering. */
  onWeakConnection(weak: boolean): void
  /** The connection is gone for good: a fresh start is needed. */
  onLost(): void
}

export interface WatchSession {
  /** From a tap: lets the sound play. */
  unlockAudio(): Promise<void>
  leave(): Promise<void>
}

/** Joins the live's video as audience, loading only its vendor's SDK. */
export async function startWatching(options: WatchOptions): Promise<WatchSession> {
  const { credentials } = options
  if (credentials.provider === 'AGORA') {
    const { watchAgora } = await import('./agora')
    return watchAgora(options, credentials)
  }
  const { watchLiveKit } = await import('./livekit')
  return watchLiveKit(options, credentials)
}

export function hostFirst(a: VideoTile, b: VideoTile): number {
  return Number(b.isHost) - Number(a.isHost)
}
