import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api, ApiError } from '../lib/api'
import type { WebSession } from '../lib/session'
import { createInboxEvents, type InboxEvents } from '../messages/events'
import type { DirectMessage } from '../messages/types'
import { startWatching, type VideoTile, type WatchSession } from '../video/watch'
import { chatErrorMessage } from './chatErrors'
import { initialLiveState, liveReducer, type LiveState } from './liveReducer'
import type { Ack, AdminAlert, ChatMessage, GuestPlacement, LiveBoard, Person, RoomState, WatchResponse } from './types'

// A second's taps go out as one batch, at most this many (backend: MAX_LIKES_PER_BATCH).
const LIKE_BATCH_MS = 1000
const MAX_LIKES_PER_BATCH = 30
const CHAT_SNAPSHOT = 30
const ANSWER_TIMEOUT_MS = 8000
// A dragged tile's preview with nothing newer for this long is dropped - the app's own timeout.
const MOVE_PREVIEW_TIMEOUT_MS = 1500
// Signing in reconnects as the account: a message sent meanwhile waits this long for the room.
const JOIN_WAIT_MS = 5000
// Lost video: started over this many times by itself (about a minute in all) before asking the viewer.
export const AUTO_RECONNECTS = 6

/** 1 s, 2 s, 4 s, 8 s, then 15 s between the automatic reconnects. */
export function reconnectDelayMs(done: number): number {
  return Math.min(1000 * 2 ** done, 15_000)
}

type JoinAck = Ack<RoomState & { chatMuted: boolean; chatMutedUntil: string | null }>
type WatchAck = Ack<RoomState & { messages: ChatMessage[] }>
type ChatAck = Ack<{ message: ChatMessage }>

export interface Live {
  state: LiveState
  tiles: VideoTile[]
  /** In the live's video (whether or not anyone's camera is on). */
  connected: boolean
  audioBlocked: boolean
  weakConnection?: boolean
  /** The video connection dropped for good: offer to reconnect. */
  videoLost: boolean
  /** Trying again by itself after the video (or loading the live) failed - no need to ask the viewer yet. */
  reconnecting: boolean
  /** The viewer's own "try again": also starts a new round of automatic reconnects. */
  retry(): void
  unlockAudio(): void
  /** Resolves to what went wrong, or null once sent. */
  sendChat(text: string): Promise<string | null>
  sendLike(): void
  setFollowing(following: boolean): Promise<void>
  dismissAlert(): void
  /** The signed-in account's direct message events, from the same connection. */
  inbox: InboxEvents
}

/**
 * One live on the web: its video, and its public updates over the app's
 * realtime connection - as the signed-in account, or else as a watch-only
 * viewer holding the ticket from POST /v1/streams/:id/watch.
 */
export function useLive(streamId: string, session: WebSession, signedIn: boolean): Live {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState)
  const [attempt, setAttempt] = useState(0)
  const [tiles, setTiles] = useState<VideoTile[]>([])
  const [connected, setConnected] = useState(false)
  const [audioBlocked, setAudioBlocked] = useState(false)
  const [weakConnection, setWeakConnection] = useState(false)
  const [videoLost, setVideoLost] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  // Settles once this socket is in the live's room: true when it can chat there (an account).
  const joined = useRef<Promise<boolean>>(Promise.resolve(false))
  const videoRef = useRef<WatchSession | null>(null)
  const pendingLikes = useRef(0)
  const likeTimer = useRef<number | null>(null)
  const [inbox] = useState(createInboxEvents)

  const restart = useCallback(() => {
    dispatch({ type: 'retry' })
    setVideoLost(false)
    setWeakConnection(false)
    setAttempt((count) => count + 1)
  }, [])

  // The video dropped for good (the SDK stops reconnecting after about 45 s
  // offline) or the live wouldn't load again: started over by itself, waiting
  // longer each time, before the Reconnect button is left to the viewer.
  const [autoReconnects, setAutoReconnects] = useState(0)
  const wantsReconnect = videoLost || (state.phase === 'error' && autoReconnects > 0)
  const reconnecting = wantsReconnect && autoReconnects < AUTO_RECONNECTS
  useEffect(() => {
    if (!reconnecting) return
    const timer = window.setTimeout(() => {
      setAutoReconnects((count) => count + 1)
      restart()
    }, reconnectDelayMs(autoReconnects))
    return () => window.clearTimeout(timer)
  }, [reconnecting, autoReconnects, restart])
  const retry = useCallback(() => {
    setAutoReconnects(0)
    restart()
  }, [restart])

  // What watching takes: video credentials, the ticket for live updates, who's on stage.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const token = await session.token()
        const watch = await api<WatchResponse>(`/v1/streams/${encodeURIComponent(streamId)}/watch`, {
          method: 'POST',
          token,
        })
        if (!cancelled) dispatch({ type: 'watching', watch })
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError && error.status === 404) dispatch({ type: 'ended', reason: null, message: null })
        else if (error instanceof ApiError && error.status === 403) dispatch({ type: 'banned' })
        else dispatch({ type: 'failed', error: error instanceof Error ? error.message : 'Something went wrong.' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [streamId, session, attempt])

  const watch = state.watch
  const playing = state.phase === 'live' && watch !== null

  // The video. Leaves as soon as the live ends or this viewer is shown out.
  useEffect(() => {
    if (!playing || !watch) return
    let cancelled = false
    let video: WatchSession | null = null
    startWatching({
      credentials: watch.rtcToken,
      channelName: watch.stream.channelName,
      hostId: watch.stream.hostId,
      hostAgoraUid: watch.hostAgoraUid,
      onTiles: (next) => {
        if (!cancelled) setTiles(next)
      },
      onAudioBlocked: (blocked) => {
        if (!cancelled) setAudioBlocked(blocked)
      },
      onWeakConnection: (weak) => {
        if (!cancelled) setWeakConnection(weak)
      },
      onLost: () => {
        if (!cancelled) setVideoLost(true)
      },
    }).then(
      (started) => {
        if (cancelled) {
          void started.leave()
          return
        }
        video = started
        videoRef.current = started
        setConnected(true)
        // Back: a later drop gets the whole round of automatic reconnects again.
        setAutoReconnects(0)
      },
      () => {
        if (!cancelled) setVideoLost(true)
      },
    )
    return () => {
      cancelled = true
      videoRef.current = null
      setTiles([])
      setConnected(false)
      setAudioBlocked(false)
      setWeakConnection(false)
      void video?.leave()
    }
  }, [playing, watch])

  // Live updates, over the app's realtime connection.
  const ticket = watch?.watchTicket
  const hostId = watch?.stream.hostId
  useEffect(() => {
    if (!playing || !ticket) return
    let asAccount = false
    let authRetried = false
    const socket = io({
      // WebSocket only, like the app: with several API instances, long-polling
      // would need sticky sessions at the load balancer.
      transports: ['websocket'],
      auth: (send) => {
        void (signedIn ? session.token() : Promise.resolve(null)).then((token) => {
          asAccount = token !== null
          send(token ? { token } : { watchTicket: ticket })
        })
      },
    })
    socketRef.current = socket
    let settle: (canChat: boolean) => void = () => undefined
    joined.current = new Promise((resolve) => {
      settle = resolve
    })

    const refused = (error: string) => {
      settle(false)
      if (error === 'STREAM_NOT_LIVE') dispatch({ type: 'ended', reason: null, message: null })
      else if (error === 'NOT_ALLOWED' && asAccount) dispatch({ type: 'banned' })
    }
    const enter = async () => {
      if (asAccount) {
        const ack = (await socket
          .timeout(ANSWER_TIMEOUT_MS)
          .emitWithAck('stream:join', { streamId })
          .catch(() => null)) as JoinAck | null
        if (!ack) return
        if (!ack.ok) return refused(ack.error)
        settle(true)
        dispatch({ type: 'room', state: ack })
        dispatch(
          ack.chatMuted
            ? { type: 'chatMuted', until: ack.chatMutedUntil ? new Date(ack.chatMutedUntil) : null }
            : { type: 'chatUnmuted' },
        )
        const token = await session.token()
        const chat = await api<{ messages: ChatMessage[] }>(
          `/v1/streams/${encodeURIComponent(streamId)}/chat?limit=${CHAT_SNAPSHOT}`,
          { token },
        ).catch(() => null)
        if (chat) dispatch({ type: 'chatSnapshot', messages: chat.messages })
        return
      }
      const ack = (await socket
        .timeout(ANSWER_TIMEOUT_MS)
        .emitWithAck('stream:watch', { streamId })
        .catch(() => null)) as WatchAck | null
      if (!ack) return
      if (!ack.ok) return refused(ack.error)
      settle(false)
      dispatch({ type: 'room', state: ack })
      dispatch({ type: 'chatSnapshot', messages: ack.messages })
    }

    socket.on('connect', () => {
      authRetried = false
      void enter()
      if (asAccount) inbox.emit({ type: 'connected' })
    })
    // Turned away at the door: a signed-in socket renews its token once (or
    // signs out and comes back watch-only); a ticket that ran out means starting over.
    socket.on('connect_error', (error) => {
      if (error.message !== 'unauthorized') return
      if (!asAccount) return restart()
      if (authRetried) return
      authRetried = true
      session.invalidate()
      socket.connect()
    })

    const here = (event: { streamId?: string | null }) => event.streamId === streamId
    socket.on('viewer_count_update', (event: { streamId: string; count: number }) => {
      if (here(event)) dispatch({ type: 'viewers', count: event.count })
    })
    socket.on('likes_update', (event: { streamId: string; total: number }) => {
      if (here(event)) dispatch({ type: 'likes', total: event.total })
    })
    socket.on('chat:new', (message: ChatMessage & { streamId: string }) => {
      if (here(message)) dispatch({ type: 'chatNew', message })
    })
    socket.on('chat:deleted', (event: { streamId: string; messageId: string }) => {
      if (here(event)) dispatch({ type: 'chatDeleted', messageId: event.messageId })
    })
    socket.on('chat:pinned', (event: { streamId: string; messageId: string; text: string; senderName: string }) => {
      if (here(event)) {
        dispatch({ type: 'pinned', pinned: { id: event.messageId, text: event.text, senderName: event.senderName } })
      }
    })
    socket.on('chat:unpinned', (event: { streamId: string }) => {
      if (here(event)) dispatch({ type: 'pinned', pinned: null })
    })
    socket.on('stream:paused', (event: { streamId: string; paused: boolean }) => {
      if (here(event)) dispatch({ type: 'paused', paused: event.paused })
    })
    socket.on('stream:host_status', (event: { streamId: string; away: boolean }) => {
      if (here(event)) dispatch({ type: 'hostAway', away: event.away })
    })
    socket.on('stream:moderators', (event: { streamId: string; moderatorIds: string[] }) => {
      if (here(event)) dispatch({ type: 'moderators', ids: event.moderatorIds })
    })
    socket.on('stream:board', (event: { streamId: string; board: LiveBoard | null }) => {
      if (here(event)) dispatch({ type: 'board', board: event.board ?? null })
    })
    socket.on('guest:joined', (event: { streamId: string; user: Person; agoraUid: number | null }) => {
      if (here(event)) dispatch({ type: 'guestJoined', guest: { ...event.user, agoraUid: event.agoraUid } })
    })
    socket.on('guest:removed', (event: { streamId: string; userId: string }) => {
      if (here(event)) dispatch({ type: 'guestLeft', userId: event.userId })
    })
    socket.on('guest:placed', (event: { streamId: string; userId: string; placement: GuestPlacement | null }) => {
      if (here(event)) dispatch({ type: 'guestPlaced', userId: event.userId, placement: event.placement })
    })
    // A preview while the host or a moderator drags a tile; one that goes quiet (their connection
    // dropped before the drop) lets the tile settle back where it was saved.
    const moveTimers = new Map<string, number>()
    socket.on('guest:moving', (event: { streamId: string; userId: string; placement: GuestPlacement | null }) => {
      if (!here(event) || !event.placement) return
      const { userId } = event
      dispatch({ type: 'guestMoving', userId, placement: event.placement })
      window.clearTimeout(moveTimers.get(userId))
      moveTimers.set(
        userId,
        window.setTimeout(() => {
          moveTimers.delete(userId)
          dispatch({ type: 'guestMoveEnded', userId })
        }, MOVE_PREVIEW_TIMEOUT_MS),
      )
    })
    socket.on('guest:spotlight', (event: { streamId: string; userId: string | null }) => {
      if (here(event)) dispatch({ type: 'guestSpotlight', userId: event.userId })
    })
    socket.on('stream_ended', (event: { streamId: string; reason?: string; message?: string }) => {
      if (here(event)) dispatch({ type: 'ended', reason: event.reason ?? null, message: event.message ?? null })
    })
    socket.on('admin:alert', (alert: AdminAlert) => {
      if (!alert.streamId || alert.streamId === streamId) dispatch({ type: 'alert', alert })
    })
    // Only ever for the account's own sockets.
    socket.on('force_disconnect', (event: { streamId?: string | null; hostId: string }) => {
      if (here(event) || event.hostId === hostId) dispatch({ type: 'banned' })
    })
    socket.on('chat:muted', (event: { streamId: string; mutedUntil: string | null }) => {
      if (here(event)) dispatch({ type: 'chatMuted', until: event.mutedUntil ? new Date(event.mutedUntil) : null })
    })
    socket.on('chat:unmuted', (event: { streamId: string }) => {
      if (here(event)) dispatch({ type: 'chatUnmuted' })
    })
    // Direct messages: only ever to the account's own sockets.
    socket.on('message:new', (event: { message: DirectMessage; sender: Person; recipient: Person }) => {
      inbox.emit({ type: 'new', ...event })
    })
    socket.on('message:read', (event: { readerId: string; partnerId: string; readAt: string }) => {
      inbox.emit({ type: 'read', ...event })
    })
    socket.on('message:unread_count', (event: { count: number }) => {
      inbox.emit({ type: 'unreadCount', count: event.count })
    })
    socket.on('message:deleted', (event: { messageId: string; senderId: string; recipientId: string }) => {
      inbox.emit({ type: 'deleted', ...event })
    })

    return () => {
      settle(false)
      socketRef.current = null
      moveTimers.forEach((timer) => window.clearTimeout(timer))
      socket.disconnect()
    }
  }, [playing, ticket, hostId, signedIn, streamId, session, restart, inbox])

  // Signed in on this page: whether they already follow the host.
  useEffect(() => {
    if (!signedIn || !hostId) return
    let cancelled = false
    void session
      .token()
      .then((token) => (token ? api<{ isFollowing: boolean }>(`/v1/users/${encodeURIComponent(hostId)}`, { token }) : null))
      .then(
        (profile) => {
          if (profile && !cancelled) dispatch({ type: 'following', following: profile.isFollowing })
        },
        () => undefined,
      )
    return () => {
      cancelled = true
    }
  }, [signedIn, hostId, session])

  useEffect(
    () => () => {
      if (likeTimer.current !== null) window.clearTimeout(likeTimer.current)
    },
    [],
  )

  const unlockAudio = useCallback(() => {
    void videoRef.current?.unlockAudio()
  }, [])

  const sendChat = useCallback(
    async (text: string): Promise<string | null> => {
      const canChat = await Promise.race([
        joined.current,
        new Promise<false>((resolve) => window.setTimeout(() => resolve(false), JOIN_WAIT_MS)),
      ])
      const socket = socketRef.current
      if (!canChat || !socket?.connected) return "Can't send right now - reconnecting."
      const ack = (await socket
        .timeout(ANSWER_TIMEOUT_MS)
        .emitWithAck('chat:send', { streamId, text, clientId: crypto.randomUUID() })
        .catch(() => null)) as ChatAck | null
      if (!ack) return "Couldn't send that. Try again."
      if (!ack.ok) return chatErrorMessage(ack.error)
      dispatch({ type: 'chatNew', message: ack.message })
      return null
    },
    [streamId],
  )

  const sendLike = useCallback(() => {
    pendingLikes.current += 1
    likeTimer.current ??= window.setTimeout(() => {
      likeTimer.current = null
      const count = Math.min(pendingLikes.current, MAX_LIKES_PER_BATCH)
      pendingLikes.current = 0
      socketRef.current?.emit('like:send', { streamId, count })
    }, LIKE_BATCH_MS)
  }, [streamId])

  const setFollowing = useCallback(
    async (following: boolean) => {
      const token = await session.token()
      if (!token || !hostId) return
      dispatch({ type: 'following', following })
      try {
        await api(`/v1/users/${encodeURIComponent(hostId)}/follow`, { method: following ? 'POST' : 'DELETE', token })
      } catch (error) {
        dispatch({ type: 'following', following: !following })
        throw error
      }
    },
    [session, hostId],
  )

  const dismissAlert = useCallback(() => dispatch({ type: 'alert', alert: null }), [])

  return {
    state,
    tiles,
    connected,
    audioBlocked,
    weakConnection,
    videoLost,
    reconnecting,
    retry,
    unlockAudio,
    sendChat,
    sendLike,
    setFollowing,
    dismissAlert,
    inbox,
  }
}
