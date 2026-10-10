import { ConnectionQuality, Room, RoomEvent, Track, type RemoteTrack } from 'livekit-client'
import type { VideoCredentials } from '../live/types'
import { hostFirst, type VideoTile, type WatchOptions, type WatchSession } from './watch'

type LiveKitCredentials = Extract<VideoCredentials, { provider: 'LIVEKIT' }>

/** A hidden, subscribe-only participant in the live's LiveKit room (the app's side: livekit_video_session.dart). */
export async function watchLiveKit(options: WatchOptions, credentials: LiveKitCredentials): Promise<WatchSession> {
  // adaptiveStream: each video comes at the size it's shown - guests' small tiles cost little.
  const room = new Room({ adaptiveStream: true })
  const audioElements = new Set<HTMLMediaElement>()
  let leaving = false
  let reconnecting = false
  let videoPaused = false
  let networkPoor = false
  const reportConnection = () => options.onWeakConnection(reconnecting || videoPaused || networkPoor)

  const showTiles = () => {
    const tiles: VideoTile[] = []
    for (const participant of room.remoteParticipants.values()) {
      const publication = participant.getTrackPublication(Track.Source.Camera)
      const track = publication?.videoTrack
      if (!track || publication.isMuted) continue
      tiles.push({
        key: `livekit-${participant.identity}-${track.sid}`,
        isHost: participant.identity === options.hostId,
        userId: participant.identity,
        mount(container, fit) {
          const video = track.attach()
          video.className = `tile-video fit-${fit}`
          container.append(video)
          return () => {
            track.detach(video)
            video.remove()
          }
        },
      })
    }
    options.onTiles(tiles.sort(hostFirst))
  }

  room
    .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach()
        audioElements.add(element)
        document.body.append(element)
      }
      showTiles()
    })
    .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      for (const element of track.detach()) {
        audioElements.delete(element)
        element.remove()
      }
      showTiles()
    })
    .on(RoomEvent.TrackMuted, showTiles)
    .on(RoomEvent.TrackUnmuted, showTiles)
    .on(RoomEvent.ParticipantDisconnected, showTiles)
    .on(RoomEvent.TrackStreamStateChanged, (_publication, state, participant) => {
      if (participant.identity !== options.hostId) return
      videoPaused = state === Track.StreamState.Paused
      reportConnection()
    })
    .on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (participant !== room.localParticipant) return
      networkPoor = quality === ConnectionQuality.Poor || quality === ConnectionQuality.Lost
      reportConnection()
    })
    .on(RoomEvent.Reconnecting, () => {
      reconnecting = true
      reportConnection()
    })
    .on(RoomEvent.Reconnected, () => {
      reconnecting = false
      reportConnection()
    })
    .on(RoomEvent.AudioPlaybackStatusChanged, () => options.onAudioBlocked(!room.canPlaybackAudio))
    .on(RoomEvent.Disconnected, () => {
      if (!leaving) options.onLost()
    })

  await room.connect(credentials.url, credentials.token, { autoSubscribe: true })
  options.onAudioBlocked(!room.canPlaybackAudio)
  showTiles()

  return {
    async unlockAudio() {
      await room.startAudio()
      options.onAudioBlocked(!room.canPlaybackAudio)
    },
    async leave() {
      leaving = true
      await room.disconnect()
      for (const element of audioElements) element.remove()
    },
  }
}
