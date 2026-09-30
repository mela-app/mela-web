import { useState } from 'react'
import { initials } from '../lib/format'

interface AvatarProps {
  person: { displayName: string; avatarUrl: string | null }
  size?: 'sm' | 'md' | 'lg'
}

/** Their picture - or their initials, when there's none or it won't load. */
export function Avatar({ person, size = 'md' }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  if (person.avatarUrl && !broken) {
    return <img className={`avatar avatar-${size}`} src={person.avatarUrl} alt="" onError={() => setBroken(true)} />
  }
  return (
    <span className={`avatar avatar-${size} avatar-initials`} aria-hidden="true">
      {initials(person.displayName)}
    </span>
  )
}
