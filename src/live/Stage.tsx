import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Avatar } from '../components/Avatar'
import { SoundOffIcon } from '../components/Icons'
import type { Fit, VideoTile } from '../video/watch'
import type { Guest, GuestPlacement, Person } from './types'

interface StageProps {
  tiles: VideoTile[]
  fit: Fit
  /** Null until the live has loaded. */
  host: Person | null
  guests: Guest[]
  /** Tiles being dragged right now, where they are - over where they were saved. */
  moving?: Record<string, GuestPlacement>
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
  const { tiles, fit, host, guests, moving = {}, connecting, paused, hostAway, audioBlocked, videoLost } = props
  const hostTile = tiles.find((tile) => tile.isHost)
  const guestOf = (tile: VideoTile) =>
    guests.find((guest) => guest.id === tile.userId || (tile.agoraUid !== undefined && guest.agoraUid === tile.agoraUid))
  // A guest on the full stage: the host takes the first spot in the column instead.
  const featuredTile = tiles.find((tile) => !tile.isHost && guestOf(tile)?.spotlight)
  const mainTile = featuredTile ?? hostTile
  const guestTiles = tiles.filter((tile) => !tile.isHost && tile !== featuredTile)
  const nameOf = (tile: VideoTile) => (tile.isHost ? host?.displayName : guestOf(tile)?.displayName)
  const placementOf = (tile: VideoTile) => {
    const guest = guestOf(tile)
    return guest ? (moving[guest.id] ?? guest.placement) : null
  }
  // Where the host put a tile, the same shares of the guest area as in the app; the rest line up.
  const placedTiles = guestTiles.filter((tile) => placementOf(tile))
  const lineTiles = [
    ...(featuredTile && hostTile ? [hostTile] : []),
    ...guestTiles.filter((tile) => !placementOf(tile)),
  ]

  return (
    <div className="stage">
      {mainTile ? (
        <TileView
          key={mainTile.key}
          tile={mainTile}
          fit={fit}
          className="tile tile-host"
          label={featuredTile ? nameOf(featuredTile) : undefined}
        />
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
            const placement = placementOf(tile)!
            const style = { '--x': placement.x, '--y': placement.y, '--size': placement.size } as CSSProperties
            const dragged = guestOf(tile)!.id in moving
            return (
              <div key={tile.key} className={dragged ? 'tile-guest-placed is-moving' : 'tile-guest-placed'} style={style}>
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
