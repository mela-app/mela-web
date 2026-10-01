/** A failed API call, with the server's own message when it gave one. */
export class ApiError extends Error {
  readonly status: number
  /** What went wrong, for the page rather than the person - e.g. `NOT_FRIENDS`. */
  readonly code: string | undefined

  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

interface ApiInit extends Omit<RequestInit, 'body'> {
  body?: unknown
  token?: string | null
}

/** The API on this origin (/v1), as JSON. */
export async function api<T>(path: string, { body, token, headers, ...init }: ApiInit = {}): Promise<T> {
  const request = new Headers(headers)
  request.set('Accept', 'application/json')
  if (body !== undefined) request.set('Content-Type', 'application/json')
  if (token) request.set('Authorization', `Bearer ${token}`)
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: request,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, "Can't reach Mela right now. Check your connection.")
  }
  if (response.status === 204) return undefined as T
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const { message, code } = errorOf(payload)
    throw new ApiError(response.status, message ?? 'Something went wrong. Try again.', code)
  }
  return payload as T
}

// The API wraps the framework's error body: `{statusCode, path, timestamp, message: <body>}`,
// <body> being a string or `{message: string | string[], code?}`. A flat `{message}` works too.
function errorOf(payload: unknown): { message: string | null; code?: string } {
  if (typeof payload !== 'object' || payload === null) return { message: null }
  let body = (payload as { message?: unknown }).message
  let code: string | undefined
  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    const inner = body as { message?: unknown; code?: unknown }
    code = typeof inner.code === 'string' ? inner.code : undefined
    body = inner.message
  }
  if (typeof body === 'string') return { message: body, code }
  if (Array.isArray(body) && typeof body[0] === 'string') return { message: body[0], code }
  return { message: null, code }
}
