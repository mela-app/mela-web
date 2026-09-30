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
