import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

/** Whether a CSS media query matches, following it as the window changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/**
 * Opens once [delayMs] after [active] turns on - once per visit (tab), so a
 * dismissed prompt doesn't keep coming back.
 */
export function useTimedNudge(active: boolean, delayMs: number, key: string): [boolean, () => void] {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!active || seen(key)) return
    const timer = window.setTimeout(() => {
      remember(key)
      setOpen(true)
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [active, delayMs, key])
  return [open, useCallback(() => setOpen(false), [])]
}

// Storage can be off (private modes): then a prompt may come back next visit, nothing worse.
function seen(key: string): boolean {
  try {
    return window.sessionStorage.getItem(key) !== null
  } catch {
    return false
  }
}

function remember(key: string): void {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // See seen().
  }
}
