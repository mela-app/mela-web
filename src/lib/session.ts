import { api, ApiError } from './api'

export interface WebUser {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

/** What a new account would start with (backend: auth/identity/identity-sign-in.service.ts). */
export interface NewAccountProfile {
  email: string
  displayName: string
  suggestedUsername: string
}

export type IdentityOutcome = { status: 'SIGNED_IN' } | { status: 'NEEDS_ACCOUNT'; profile: NewAccountProfile }

export interface NewAccount {
  idToken: string
  username: string
  displayName: string
}

// Only after a sign-in here does a visit ask the API for a session.
const SIGNED_IN_KEY = 'mela.web.signedIn'
// The API refuses these routes without it (backend: auth/web-auth.controller.ts).
const CLIENT = { 'X-Requested-With': 'mela-web' }
// Renewed a little early, so no request goes out with a token about to expire.
const EARLY_RENEWAL_MS = 60_000

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * The browser's local storage - or, where it's off or refuses (private
 * modes, blocked storage), memory: signing in then lasts just this visit.
 */
export function browserStorage(): SessionStorage {
  const memory = new Map<string, string>()
  const fallback: SessionStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => void memory.set(key, value),
    removeItem: (key) => void memory.delete(key),
  }
  let local: Storage
  try {
    local = window.localStorage
  } catch {
    return fallback
  }
  return {
    getItem: (key) => {
      try {
        return local.getItem(key)
      } catch {
        return fallback.getItem(key)
      }
    },
    setItem: (key, value) => {
      try {
        local.setItem(key, value)
      } catch {
        fallback.setItem(key, value)
      }
    },
    removeItem: (key) => {
      try {
        local.removeItem(key)
      } catch {
        // Nothing stored there to remove.
      }
      fallback.removeItem(key)
    },
  }
}

/**
 * Signing in on the web: the refresh token stays in an httpOnly cookie the
 * page can't read; the short-lived access token lives only in memory.
 */
export class WebSession {
  private accessToken: string | null = null
  private expiresAt = 0
  private renewing: Promise<string | null> | null = null
  private current: WebUser | null = null
  private readonly listeners = new Set<() => void>()
  private readonly storage: SessionStorage

  constructor(storage: SessionStorage = browserStorage()) {
    this.storage = storage
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Who's signed in, or null - for useSyncExternalStore. */
  getUser = (): WebUser | null => this.current

  /** Picks up the session of an earlier visit, if this browser had one. */
  async restore(): Promise<void> {
    await this.token()
  }

  async login(usernameOrEmail: string, password: string): Promise<void> {
    const { accessToken } = await api<{ accessToken: string }>('/v1/auth/web/login', {
      method: 'POST',
      headers: CLIENT,
      body: { usernameOrEmail, password },
    })
    await this.adopt(accessToken)
  }

  /** Continue with Google: signed in when they have an account, else what theirs would start with. */
  async continueWithIdentity(idToken: string): Promise<IdentityOutcome> {
    const result = await api<{ status: 'SIGNED_IN'; accessToken: string } | ({ status: 'NEEDS_ACCOUNT' } & NewAccountProfile)>(
      '/v1/auth/web/identity',
      { method: 'POST', headers: CLIENT, body: { idToken } },
    )
    if (result.status === 'SIGNED_IN') {
      await this.adopt(result.accessToken)
      return { status: 'SIGNED_IN' }
    }
    const { email, displayName, suggestedUsername } = result
    return { status: 'NEEDS_ACCOUNT', profile: { email, displayName, suggestedUsername } }
  }

  async createAccount(account: NewAccount): Promise<void> {
    const { accessToken } = await api<{ accessToken: string }>('/v1/auth/web/identity/signup', {
      method: 'POST',
      headers: CLIENT,
      body: account,
    })
    await this.adopt(accessToken)
  }

  async logout(): Promise<void> {
    this.clear()
    await api('/v1/auth/web/logout', { method: 'POST', headers: CLIENT }).catch(() => undefined)
  }

  /** A current access token, renewed when it's about to run out; null when signed out. */
  async token(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.expiresAt - EARLY_RENEWAL_MS) return this.accessToken
    if (!this.accessToken && !this.storage.getItem(SIGNED_IN_KEY)) return null
    this.renewing ??= this.renew().finally(() => {
      this.renewing = null
    })
    return this.renewing
  }

  /** The API turned the token down: the next one is renewed first. */
  invalidate(): void {
    this.expiresAt = 0
  }

  private async renew(): Promise<string | null> {
    try {
      const { accessToken } = await api<{ accessToken: string }>('/v1/auth/web/refresh', {
        method: 'POST',
        headers: CLIENT,
      })
      await this.adopt(accessToken)
      return accessToken
    } catch (error) {
      // Offline, the session may still be good next time; refused, it's over.
      if (!(error instanceof ApiError) || error.status !== 0) this.clear()
      return null
    }
  }

  private async adopt(accessToken: string): Promise<void> {
    const claims = claimsOf(accessToken)
    this.accessToken = accessToken
    this.expiresAt = claims.exp * 1000
    this.storage.setItem(SIGNED_IN_KEY, '1')
    if (this.current?.id !== claims.sub) {
      const me = await api<WebUser>('/v1/users/me', { token: accessToken }).catch(() => null)
      this.current = {
        id: claims.sub,
        username: me?.username ?? claims.username,
        displayName: me?.displayName ?? claims.username,
        avatarUrl: me?.avatarUrl ?? null,
      }
      this.notify()
    }
  }

  private clear(): void {
    const hadUser = this.current !== null
    this.accessToken = null
    this.expiresAt = 0
    this.current = null
    this.storage.removeItem(SIGNED_IN_KEY)
    if (hadUser) this.notify()
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

function claimsOf(token: string): { sub: string; username: string; exp: number } {
  const payload = token.split('.')[1] ?? ''
  const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
  return JSON.parse(json) as { sub: string; username: string; exp: number }
}
