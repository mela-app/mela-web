/** 999, 1.2K, 3.4M - how the app shows counts. */
export function compactCount(count: number): string {
  if (count < 1000) return String(count)
  const [value, unit] = count < 1_000_000 ? [count / 1000, 'K'] : [count / 1_000_000, 'M']
  const rounded = value < 10 ? Math.floor(value * 10) / 10 : Math.floor(value)
  return `${rounded}${unit}`
}

/** Up to two initials, for an avatar without a picture. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
  return letters.toUpperCase() || '?'
}

const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const monthDay = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const clock = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** "now", "5m", "3h", "Mon", "Sep 3" - how long ago, for a list row. */
export function shortTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const minutes = Math.floor((now.getTime() - then.getTime()) / 60_000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return hours < 24 * 7 ? weekday.format(then) : monthDay.format(then)
}

/** "2:05 PM", "Yesterday 2:05 PM", "Mon 2:05 PM", "Sep 3, 2:05 PM" - between messages. */
export function messageTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const time = clock.format(then)
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(then)) / 86_400_000)
  if (days === 0) return time
  if (days === 1) return `Yesterday ${time}`
  if (days < 7) return `${weekday.format(then)} ${time}`
  return `${monthDay.format(then)}, ${time}`
}
