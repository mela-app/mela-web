import { useCallback, useEffect, useRef, useState } from 'react'

// How long one heart floats up; matches the CSS animation.
const FLOAT_MS = 1400
// Tapping fast still shows at most this many at once.
const MAX_HEARTS = 12
const COLORS = ['#FF3B5C', '#F5A623', '#FF7A93', '#FFD27A']

export interface Heart {
  id: number
  drift: number
  color: string
}

/** Hearts floating up from the like button: `pop()` adds one. */
export function useHearts(): [Heart[], () => void] {
  const [hearts, setHearts] = useState<Heart[]>([])
  const next = useRef(0)
  const timers = useRef(new Set<number>())

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const pop = useCallback(() => {
    const id = next.current++
    const heart = { id, drift: Math.round(Math.random() * 40 - 20), color: COLORS[id % COLORS.length] }
    setHearts((current) => [...current.slice(-(MAX_HEARTS - 1)), heart])
    const timer = window.setTimeout(() => {
      timers.current.delete(timer)
      setHearts((current) => current.filter((item) => item.id !== id))
    }, FLOAT_MS)
    timers.current.add(timer)
  }, [])

  return [hearts, pop]
}
