import AgoraRTC from 'agora-rtc-sdk-ng'
import type { IAgoraRTCRemoteUser, RemoteStreamFallbackType, RemoteStreamType } from 'agora-rtc-sdk-ng'
import type { VideoCredentials } from '../live/types'
import { hostFirst, type VideoTile, type WatchOptions, type WatchSession } from './watch'

// The SDK's enums are types only; these are their values.
const WARNINGS_AND_ERRORS = 2
const LOW_STREAM = 1 as RemoteStreamType
// On a weak connection: the smaller video first, then sound alone.
const AUDIO_ONLY_FALLBACK = 2 as RemoteStreamFallbackType

type AgoraCredentials = Extract<VideoCredentials, { provider: 'AGORA' }>

/** Audience in the live's Agora channel (the app's own side: agora_video_session.dart). */
export async function watchAgora(options: WatchOptions, credentials: AgoraCredentials): Promise<WatchSession> {
  AgoraRTC.setLogLevel(WARNINGS_AND_ERRORS)
  AgoraRTC.disableLogUpload()
  const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8', role: 'audience' })
  const users = new Map<string, IAgoraRTCRemoteUser>()
  let leaving = false

  const tileOf = (user: IAgoraRTCRemoteUser): VideoTile => ({
    key: `agora-${user.uid}-${user.videoTrack?.getTrackId() ?? ''}`,
    isHost: Number(user.uid) === options.hostAgoraUid,
    agoraUid: Number(user.uid),
    mount(container, fit) {
      user.videoTrack?.play(container, { fit })
      return () => user.videoTrack?.stop()
    },
  })
  const showTiles = () =>
    options.onTiles(
      [...users.values()]
        .filter((user) => user.hasVideo && user.videoTrack)
        .map(tileOf)
        .sort(hostFirst),
    )

  AgoraRTC.onAutoplayFailed = () => options.onAudioBlocked(true)
  client.on('user-published', async (user, mediaType) => {
    try {
      await client.subscribe(user, mediaType)
    } catch {
      return
    }
    users.set(String(user.uid), user)
    if (mediaType === 'audio') {
      user.audioTrack?.play()
      return
    }
    // Guests are small tiles: their small stream is plenty.
    if (Number(user.uid) !== options.hostAgoraUid) {
      void client.setRemoteVideoStreamType(user.uid, LOW_STREAM).catch(() => undefined)
    }
    void client.setStreamFallbackOption(user.uid, AUDIO_ONLY_FALLBACK).catch(() => undefined)
    showTiles()
  })
  client.on('user-unpublished', (_user, mediaType) => {
    if (mediaType === 'video') showTiles()
  })
  client.on('user-left', (user) => {
    users.delete(String(user.uid))
    showTiles()
  })
  client.on('connection-state-change', (state) => {
    if (state === 'DISCONNECTED' && !leaving) options.onLost()
  })
  client.on('token-privilege-did-expire', () => options.onLost())

  await client.join(credentials.appId, options.channelName, credentials.token, credentials.uid)

  return {
    async unlockAudio() {
      for (const user of users.values()) user.audioTrack?.play()
      options.onAudioBlocked(false)
    },
    async leave() {
      leaving = true
      AgoraRTC.onAutoplayFailed = undefined
      await client.leave()
    },
  }
}
