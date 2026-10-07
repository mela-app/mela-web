import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WebSession, WebUser } from '../lib/session'
import { createInboxEvents } from './events'
import { Inbox } from './Inbox'
import type { Conversation, DirectMessage } from './types'

const me: WebUser = { id: 'me', username: 'selam', displayName: 'Selam', avatarUrl: null }
const ben = { id: 'ben', username: 'ben', displayName: 'Ben', avatarUrl: null }
const cal = { id: 'cal', username: 'cal', displayName: 'Cal', avatarUrl: null }
const dan = { id: 'dan', username: 'dan', displayName: 'Dan', avatarUrl: null }
const session = { token: async () => 'access-token' } as unknown as WebSession

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

let sequence = 0
// Ids sort in the order messages are made, like the server's time-ordered ones.
function message(from: string, to: string, text: string, extra: Partial<DirectMessage> = {}): DirectMessage {
  sequence += 1
  return {
    id: `m${String(sequence).padStart(4, '0')}`,
    senderId: from,
    recipientId: to,
    text,
    clientId: null,
    createdAt: new Date().toISOString(),
    readAt: null,
    ...extra,
  }
}

const inbox = (items: Conversation[]) => () => json(200, { items, hasMore: false, nextCursor: null })

const fetchMock = vi.fn<typeof fetch>()
const requests: string[] = []

/** The API: each "METHOD /path" answers as given, with the request's JSON body. */
function serve(routes: Record<string, (body: Record<string, unknown>) => Response | Promise<Response>>) {
  fetchMock.mockImplementation(async (input, init) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`
    requests.push(key)
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {}
    return routes[key]?.(body) ?? json(404, { message: 'Not found' })
  })
}

describe('Inbox', () => {
  beforeEach(() => {
    requests.length = 0
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists conversations and keeps up with new messages and reads', async () => {
    serve({
      'GET /v1/me/conversations': inbox([
        { user: ben, lastMessage: message('ben', 'me', 'on my way'), unreadCount: 2, canMessage: true },
        { user: cal, lastMessage: message('me', 'cal', 'see you'), unreadCount: 0, canMessage: true },
      ]),
    })
    const events = createInboxEvents()
    render(<Inbox session={session} self={me} events={events} />)

    expect(await screen.findByText('on my way')).toBeInTheDocument()
    expect(screen.getByText('You: see you')).toBeInTheDocument()
    expect(within(screen.getByRole('button', { name: /^Ben/ })).getByText(/unread/)).toBeInTheDocument()

    // A first message from someone new goes on top.
    act(() => events.emit({ type: 'new', message: message('dan', 'me', 'hey there'), sender: dan, recipient: me }))
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText('hey there')).toBeInTheDocument()
    expect(within(rows[0]).getByText(/unread/)).toBeInTheDocument()

    // Read on another device: Ben's count clears here too.
    act(() => events.emit({ type: 'read', readerId: 'me', partnerId: 'ben', readAt: new Date().toISOString() }))
    expect(within(screen.getByRole('button', { name: /^Ben/ })).queryByText(/unread/)).not.toBeInTheDocument()
  })

  it('opens a conversation: reads it, then sends a message that shows at once - and only once', async () => {
    let reply: (response: Response) => void = () => undefined
    let sent: Record<string, unknown> = {}
    serve({
      'GET /v1/me/conversations': inbox([
        { user: ben, lastMessage: message('ben', 'me', 'hi Selam'), unreadCount: 1, canMessage: true },
      ]),
      'GET /v1/me/conversations/ben/messages': () =>
        json(200, {
          user: ben,
          canMessage: true,
          messages: [message('me', 'ben', 'hello', { readAt: new Date().toISOString() }), message('ben', 'me', 'hi Selam')],
          hasEarlier: false,
        }),
      'POST /v1/me/conversations/ben/read': () => json(201, { ok: true, unreadCount: 0 }),
      'POST /v1/me/conversations/ben/messages': (body) => {
        sent = body
        return new Promise((resolve) => {
          reply = resolve
        })
      },
    })
    const events = createInboxEvents()
    const user = userEvent.setup()
    render(<Inbox session={session} self={me} events={events} />)

    await user.click(await screen.findByRole('button', { name: /^Ben/ }))

    expect(await screen.findByRole('heading', { name: 'Ben' })).toBeInTheDocument()
    expect(screen.getByText('hi Selam')).toBeInTheDocument()
    await waitFor(() => expect(requests).toContain('POST /v1/me/conversations/ben/read'))

    await user.type(screen.getByLabelText('Message Ben'), '  how are you?  {Enter}')
    expect(screen.getByText('how are you?')).toBeInTheDocument()
    expect(screen.getByText('Sending…')).toBeInTheDocument()
    expect(sent).toEqual({ text: 'how are you?', clientId: expect.any(String) })

    // The echo to this account's own sockets can beat the answer.
    const stored = message('me', 'ben', 'how are you?', { clientId: sent.clientId as string })
    act(() => events.emit({ type: 'new', message: stored, sender: me, recipient: ben }))
    await act(async () => reply(json(201, stored)))

    expect(screen.getAllByText('how are you?')).toHaveLength(1)
    expect(screen.getByText('Sent')).toBeInTheDocument()

    // Ben reads it.
    act(() => events.emit({ type: 'read', readerId: 'ben', partnerId: 'me', readAt: new Date(Date.now() + 1000).toISOString() }))
    expect(screen.getByText('Seen')).toBeInTheDocument()
  })

  it("once they don't follow each other, a message isn't sent and the conversation says why", async () => {
    serve({
      'GET /v1/me/conversations': inbox([{ user: ben, lastMessage: message('ben', 'me', 'bye'), unreadCount: 0, canMessage: true }]),
      'GET /v1/me/conversations/ben/messages': () =>
        json(200, { user: ben, canMessage: true, messages: [message('ben', 'me', 'bye', { readAt: new Date().toISOString() })], hasEarlier: false }),
      'POST /v1/me/conversations/ben/messages': () =>
        json(403, {
          statusCode: 403,
          message: { message: 'You can message each other once you follow each other', code: 'NOT_FRIENDS' },
        }),
    })
    const user = userEvent.setup()
    render(<Inbox session={session} self={me} events={createInboxEvents()} />)

    await user.click(await screen.findByRole('button', { name: /^Ben/ }))
    await user.type(await screen.findByLabelText('Message Ben'), 'still there?{Enter}')

    expect(await screen.findByText("Not sent - you don't follow each other anymore.")).toBeInTheDocument()
    expect(screen.queryByLabelText('Message Ben')).not.toBeInTheDocument()
    expect(screen.getByText(/once you both follow each other/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByText('still there?')).not.toBeInTheDocument()
  })

  it('starts a new conversation with a friend', async () => {
    serve({
      'GET /v1/me/conversations': inbox([]),
      'GET /v1/users/me/friends': () => json(200, { items: [cal], hasMore: false, nextCursor: null }),
      'GET /v1/me/conversations/cal/messages': () =>
        json(200, { user: cal, canMessage: true, messages: [], hasEarlier: false }),
    })
    const user = userEvent.setup()
    render(<Inbox session={session} self={me} events={createInboxEvents()} />)

    expect(await screen.findByText('No messages yet')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New message' }))
    await user.click(await screen.findByRole('button', { name: /Cal/ }))

    expect(await screen.findByText('Say hi to Cal')).toBeInTheDocument()
    expect(screen.getByLabelText('Message Cal')).toHaveFocus()
  })

  it("a message Mela's safety team removed disappears from the open conversation", async () => {
    const reported = message('ben', 'me', 'something nasty', { readAt: new Date().toISOString() })
    serve({
      'GET /v1/me/conversations': inbox([{ user: ben, lastMessage: reported, unreadCount: 0, canMessage: true }]),
      'GET /v1/me/conversations/ben/messages': () =>
        json(200, { user: ben, canMessage: true, messages: [message('me', 'ben', 'hello'), reported], hasEarlier: false }),
    })
    const events = createInboxEvents()
    const user = userEvent.setup()
    render(<Inbox session={session} self={me} events={events} />)

    await user.click(await screen.findByRole('button', { name: /^Ben/ }))
    expect(await screen.findByText('something nasty')).toBeInTheDocument()

    act(() => events.emit({ type: 'deleted', messageId: reported.id, senderId: 'ben', recipientId: 'me' }))

    expect(screen.queryByText('something nasty')).not.toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })
})
