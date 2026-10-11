/**
 * The 18+ age check and the Terms/Privacy at sign-up (docs/features/legal.md,
 * in mela-admin-web) - the API checks both again.
 */

export interface LegalInfo {
  version: string
  minimumAge: number
}

export const TERMS_PATH = '/terms'
export const PRIVACY_PATH = '/privacy'

/** Whole years from [birthDate] (YYYY-MM-DD) to [today]; null for anything else. */
export function ageOn(birthDate: string, today: Date = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  let age = today.getFullYear() - year
  const thisMonth = today.getMonth() + 1
  if (thisMonth < month || (thisMonth === month && today.getDate() < day)) age -= 1
  return age
}

/** Today as YYYY-MM-DD, the latest date of birth the picker offers. */
export function todayIso(today: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}

// Someone who said they're too young can't simply try another date: this
// browser waits a day (Google Play's neutral age screen, as in the app).
const LOCK_KEY = 'mela.ageGate.lockedUntil'
const LOCK_MS = 24 * 60 * 60 * 1000

export function isAgeGateLocked(now: number = Date.now()): boolean {
  try {
    const until = Number(window.localStorage.getItem(LOCK_KEY))
    return Number.isFinite(until) && now < until
  } catch {
    return false
  }
}

export function lockAgeGate(now: number = Date.now()): void {
  try {
    window.localStorage.setItem(LOCK_KEY, String(now + LOCK_MS))
  } catch {
    // Private browsing: the API still refuses.
  }
}
