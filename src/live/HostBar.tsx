import { Avatar } from '../components/Avatar'
import { EyeIcon } from '../components/Icons'
import { compactCount } from '../lib/format'
import type { Person } from './types'

interface HostBarProps {
  host: Person
  viewerCount: number
  following: boolean
  /** The signed-in viewer is the host (watching their own live here). */
  isSelf: boolean
  onFollow(): void
}

export function HostBar({ host, viewerCount, following, isSelf, onFollow }: HostBarProps) {
  return (
    <div className="host-bar">
      <Avatar person={host} />
      <div className="host-meta">
        <strong className="host-name">{host.displayName}</strong>
        <span className="viewers" aria-label={`${viewerCount} watching`}>
          <EyeIcon width={14} height={14} /> {compactCount(viewerCount)}
        </span>
      </div>
      {!isSelf && (
        <button
          type="button"
          className={following ? 'btn btn-small btn-quiet' : 'btn btn-small btn-primary'}
          aria-pressed={following}
          onClick={onFollow}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  )
}
