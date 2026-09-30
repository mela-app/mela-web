import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSession } from './session'

const SIGNED_IN = 'mela.web.signedIn'
const me = { id: 'user-1', username: 'abebe', displayName: 'Abebe K', avatarUrl: null }

const jwt = (secondsLeft: number) =>
  `header.${btoa(JSON.stringify({ sub: 'user-1', username: 'abebe', exp: Math.floor(Date.now() / 1000) + secondsLeft }))}.signature`

function memoryStorage(signedIn = false) {
  const values = new Map<string, string>(signedIn ? [[SIGNED_IN, '1']] : [])
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
}

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const fetchMock = vi.fn<typeof fetch>()
const calls = (path: string) => fetchMock.mock.calls.filter(([input]) => String(input) === path)

/** The API: each path answers as given; /v1/users/me answers with `me`. */
function api(routes: Record<string, () => Response | Promise<Response>>) {
  fetchMock.mockImplementation(async (input) => {
    const path = String(input)
    if (routes[path]) return routes[path]()
    if (path === '/v1/users/me') return json(200, me)
    return json(404, { message: 'Not found' })
  })
}

describe('WebSession', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('logs in, keeping the access token in memory and only a marker in storage', async () => {
    const token = jwt(900)
    api({ '/v1/auth/web/login': () => json(200, { accessToken: token }) })
    const storage = memoryStorage()
    const session = new WebSession(storage)
    const changed = vi.fn()
    session.subscribe(changed)

    await session.login('abebe', 'secret123')

    expect(session.getUser()).toEqual(me)
    expect(changed).toHaveBeenCalledTimes(1)
    expect(await session.token()).toBe(token)
    expect(storage.getItem(SIGNED_IN)).toBe('1')
    const [, init] = calls('/v1/auth/web/login')[0]
    expect(new Headers(init?.headers).get('X-Requested-With')).toBe('mela-web')
    expect(init?.body).toBe(JSON.stringify({ usernameOrEmail: 'abebe', password: 'secret123' }))
  })

  it('asks the API for nothing on a first visit', async () => {
    const session = new WebSession(memoryStorage())
    expect(await session.token()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renews from the cookie on a return visit - once, however many ask at the same time', async () => {
    const token = jwt(900)
    api({ '/v1/auth/web/refresh': () => json(200, { accessToken: token }) })
    const session = new WebSession(memoryStorage(true))

    expect(await Promise.all([session.token(), session.token(), session.restore()])).toEqual([token, token, undefined])
    expect(calls('/v1/auth/web/refresh')).toHaveLength(1)
    expect(session.getUser()).toEqual(me)
  })

  it('renews a token that is about to run out', async () => {
    const fresh = jwt(900)
    api({
      '/v1/auth/web/login': () => json(200, { accessToken: jwt(30) }),
      '/v1/auth/web/refresh': () => json(200, { accessToken: fresh }),
    })
    const session = new WebSession(memoryStorage())
    await session.login('abebe', 'secret123')

    expect(await session.token()).toBe(fresh)
  })

  it('signs out when the API turns the renewal down', async () => {
    api({ '/v1/auth/web/refresh': () => json(401, { message: 'Invalid or expired refresh token' }) })
    const storage = memoryStorage(true)
    const session = new WebSession(storage)

    expect(await session.token()).toBeNull()
    expect(session.getUser()).toBeNull()
    expect(storage.getItem(SIGNED_IN)).toBeNull()
  })

  it('keeps the session through a dropped connection', async () => {
    api({ '/v1/auth/web/refresh': () => Promise.reject(new TypeError('Failed to fetch')) })
    const storage = memoryStorage(true)
    const session = new WebSession(storage)

    expect(await session.token()).toBeNull()
    expect(storage.getItem(SIGNED_IN)).toBe('1')
  })

  it('logs out here even when the API cannot be reached', async () => {
    api({
      '/v1/auth/web/login': () => json(200, { accessToken: jwt(900) }),
      '/v1/auth/web/logout': () => Promise.reject(new TypeError('Failed to fetch')),
    })
    const storage = memoryStorage()
    const session = new WebSession(storage)
    await session.login('abebe', 'secret123')

    await session.logout()

    expect(session.getUser()).toBeNull()
    expect(await session.token()).toBeNull()
    expect(storage.getItem(SIGNED_IN)).toBeNull()
  })
})
