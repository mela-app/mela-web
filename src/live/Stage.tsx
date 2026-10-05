import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { SoundOffIcon } from '../components/Icons'
import type { Fit, VideoTile } from '../video/watch'
import type { Guest, Person } from './types'

interface StageProps {
  tiles: VideoTile[]
  fit: Fit
  /** Null until the live has loaded. */
  host: Person | null
  guests: Guest[]
  connecting: boolean
  paused: boolean
  hostAway: boolean
  audioBlocked: boolean
  videoLost: boolean
  onUnlockAudio(): void
  onReconnect(): void
}

/** The host's video, anyone on stage beside it, and what to say when there's nothing to show. */
export function Stage(props: StageProps) {
  const { tiles, fit, host, guests, connecting, paused, hostAway, audioBlocked, videoLost } = props
  const hostTile = tiles.find((tile) => tile.isHost)
  const guestTiles = tiles.filter((tile) => !tile.isHost)
  const guestOf = (tile: VideoTile) =>
    guests.find((guest) => guest.id === tile.userId || (tile.agoraUid !== undefined && guest.agoraUid === tile.agoraUid))
  const nameOf = (tile: VideoTile) => guestOf(tile)?.displayName
  // Where the host put a tile, the same shares of the guest area as in the app; the rest line up.
  const placedTiles = guestTiles.filter((tile) => guestOf(tile)?.placement)
  const lineTiles = guestTiles.filter((tile) => !guestOf(tile)?.placement)

  return (
    <div className="stage">
      {hostTile ? (
        <TileView key={hostTile.key} tile={hostTile} fit={fit} className="tile tile-host" />
      ) : (
        host && (
          <div className="stage-poster">
            <Avatar person={host} size="lg" />
          </div>
        )
      )}

      {lineTiles.length > 0 && (
        <div className="stage-guests">
          {lineTiles.map((tile) => (
            <TileView key={tile.key} tile={tile} fit="cover" className="tile tile-guest" label={nameOf(tile)} />
          ))}
        </div>
      )}

      {placedTiles.length > 0 && (
        <div className="stage-guest-area">
          {placedTiles.map((tile) => {
            const placement = guestOf(tile)!.placement!
            const style = { '--x': placement.x, '--y': placement.y, '--size': placement.size } as CSSProperties
            return (
              <div key={tile.key} className="tile-guest-placed" style={style}>
                <TileView tile={tile} fit="cover" className="tile tile-guest" label={nameOf(tile)} />
              </div>
            )
          })}
        </div>
      )}

      {paused ? (
        <StageNotice title="Live paused" body="The host will be back soon." />
      ) : hostAway ? (
        <StageNotice title="The host stepped away" body="They'll be right back." />
      ) : videoLost ? (
        <StageNotice title="Video connection lost" body="Check your connection, then try again.">
          <button type="button" className="btn btn-primary" onClick={props.onReconnect}>
            Reconnect
          </button>
        </StageNotice>
      ) : (
        (connecting || (!hostTile && !host)) && (
          <div className="stage-notice" role="status">
            <span className="spinner" aria-hidden="true" />
            <span className="visually-hidden">Joining the live</span>
          </div>
        )
      )}

      {audioBlocked && !videoLost && (
        <button type="button" className="unmute" onClick={props.onUnlockAudio}>
          <SoundOffIcon width={18} height={18} /> Tap to unmute
        </button>
      )}
    </div>
  )
}

function StageNotice({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="stage-notice" role="status">
      <strong>{title}</strong>
      <span>{body}</span>
      {children}
    </div>
  )
}

function TileView({ tile, fit, className, label }: { tile: VideoTile; fit: Fit; className: string; label?: string }) {
  const box = useRef<HTMLDivElement>(null)
  // Rendered keyed by tile.key, so the video this mounted with stays the one it shows.
  const [mount] = useState(() => tile.mount)
  useEffect(() => {
    const element = box.current
    if (!element) return
    return mount(element, fit)
  }, [mount, fit])
  return (
    <div ref={box} className={className}>
      {label && <span className="tile-label">{label}</span>}
    </div>
  )
}
