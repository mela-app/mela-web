/** A failed API call, with the server's own message when it gave one. */
export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
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
  if (!response.ok) throw new ApiError(response.status, messageOf(payload) ?? 'Something went wrong. Try again.')
  return payload as T
}

function messageOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const message = (payload as { message?: unknown }).message
  if (typeof message === 'string') return message
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  return null
}
