import { HeartIcon } from '../components/Icons'
import type { Heart } from './useHearts'

export function Hearts({ hearts }: { hearts: Heart[] }) {
  return (
    <div className="hearts" aria-hidden="true">
      {hearts.map((heart) => (
        <HeartIcon
          key={heart.id}
          className="heart"
          width={26}
          height={26}
          style={{ color: heart.color, translate: `${heart.drift}px 0` }}
        />
      ))}
    </div>
  )
}
