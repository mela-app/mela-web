import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App, NUDGE_AFTER_MS, NUDGE_KEY } from './App'
import type { PlayerConfig } from './config'
import type { Device } from './lib/device'
import { WebSession, type WebUser } from './lib/session'
import { initialLiveState, liveReducer, type LiveAction } from './live/liveReducer'
import type { Live } from './live/useLive'
import { createInboxEvents } from './messages/events'

const current = vi.hoisted(() => ({ live: null as unknown }))
vi.mock('./live/useLive', () => ({ useLive: () => current.live }))

const host = { id: 'host-1', username: 'abebe', displayName: 'Abebe', avatarUrl: null }
const config: PlayerConfig = {
  streamId: 'live-1',
  appScheme: 'gamblinglive',
  androidPackage: 'com.gamblinglive.app',
  androidInstallUrl: 'https://play.google.com/store/apps/details?id=com.gamblinglive.app',
  iosInstallUrl: null,
}
const phone: Device = { platform: 'android', mobile: true }
const computer: Device = { platform: 'other', mobile: false }

// Tests play the server's part on the inbox events.
type TestLive = Live & { inbox: ReturnType<typeof createInboxEvents> }

function watching(...then: LiveAction[]): TestLive {
  let state = liveReducer(initialLiveState, {
    type: 'watching',
    watch: {
      stream: { id: 'live-1', title: 'Friday night', hostId: host.id, host, channelName: 'channel-1' },
      rtcToken: { provider: 'LIVEKIT', url: 'wss://video.example', token: 'video-token' },
      watchTicket: 'ticket',
      isFollowingHost: false,
      pinnedMessage: null,
      activeGuests: [],
      hostAgoraUid: 1,
    },
  })
  for (const action of then) state = liveReducer(state, action)
  const live: TestLive = {
    state,
    tiles: [],
    connected: true,
    audioBlocked: false,
    videoLost: false,
    retry: vi.fn(),
    unlockAudio: vi.fn(),
    sendChat: vi.fn(async () => null),
    sendLike: vi.fn(),
    setFollowing: vi.fn(async () => undefined),
    dismissAlert: vi.fn(),
    inbox: createInboxEvents(),
  }
  current.live = live
  return live
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// The API as the inbox sees it; anything else is not found.
const fetchMock = vi.fn<typeof fetch>(async (input) => {
  if (String(input) === '/v1/me/conversations/unread-count') return json(200, { count: 3 })
  if (String(input) === '/v1/me/conversations') return json(200, { items: [], hasMore: false, nextCursor: null })
  return json(404, { message: 'Not found' })
})

const signedOut = () => new WebSession({ getItem: () => null, setItem: () => undefined, removeItem: () => undefined })

function signedIn(): WebSession {
  const user: WebUser = { id: 'user-1', username: 'selam', displayName: 'Selam', avatarUrl: null }
  return {
    subscribe: () => () => undefined,
    getUser: () => user,
    token: async () => 'access-token',
    logout: vi.fn(async () => undefined),
  } as unknown as WebSession
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe('on a phone', () => {
    it('keeps a way into the app on screen', () => {
      watching()
      render(<App config={config} session={signedOut()} device={phone} />)
      expect(screen.getByText('Chat, like and go live in the app')).toBeInTheDocument()
    })

    it('asks for the app to chat', async () => {
      watching()
      render(<App config={config} session={signedOut()} device={phone} />)

      await userEvent.click(screen.getByRole('button', { name: 'Say something…' }))

      expect(screen.getByRole('dialog', { name: 'Chat with Abebe in the app' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Open in the app' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Get the app' })).toHaveAttribute('href', config.androidInstallUrl)
    })

    it('asks for the app to like, follow, or join the stage', async () => {
      const live = watching()
      render(<App config={config} session={signedOut()} device={phone} />)

      for (const [button, title] of [
        ['Like', 'Send likes from the app'],
        ['Follow', 'Follow Abebe in the app'],
        ['Join the stage', 'Join the stage from the app'],
      ]) {
        await userEvent.click(screen.getByRole('button', { name: button }))
        expect(screen.getByRole('dialog', { name: title })).toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      }
      expect(live.sendLike).not.toHaveBeenCalled()
      expect(live.setFollowing).not.toHaveBeenCalled()
    })

    it('leaves messaging to the app', () => {
      watching()
      render(<App config={config} session={signedIn()} device={phone} />)
      expect(screen.queryByRole('button', { name: /^Inbox/ })).not.toBeInTheDocument()
    })
  })

  describe('on a computer', () => {
    it('asks them to log in to join in', async () => {
      const live = watching()
      render(<App config={config} session={signedOut()} device={computer} />)

      await userEvent.click(screen.getByRole('button', { name: 'Like' }))

      expect(screen.getByRole('dialog', { name: 'Log in to send likes' })).toBeInTheDocument()
      // This page has no Firebase settings: new accounts are made in the app.
      expect(screen.getByText('New to Mela? Sign up in the app, then log in here.')).toBeInTheDocument()
      expect(live.sendLike).not.toHaveBeenCalled()
    })

    it("offers Continue with Google once the page has Firebase's settings", async () => {
      watching()
      const firebase = { apiKey: 'key', authDomain: 'mela.firebaseapp.com', projectId: 'mela', appId: '1:2:web:3' }
      render(<App config={{ ...config, firebase }} session={signedOut()} device={computer} />)

      await userEvent.click(screen.getByRole('button', { name: 'Like' }))

      expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    })

    it('hands the stage over to their phone', async () => {
      watching()
      render(<App config={config} session={signedOut()} device={computer} />)

      await userEvent.click(screen.getByRole('button', { name: 'Join the stage' }))

      expect(screen.getByRole('dialog', { name: 'Join the stage from your phone' })).toBeInTheDocument()
    })

    it('lets a signed-in viewer like, follow and chat right here', async () => {
      const live = watching()
      render(<App config={config} session={signedIn()} device={computer} />)

      await userEvent.click(screen.getByRole('button', { name: 'Like' }))
      await userEvent.click(screen.getByRole('button', { name: 'Follow' }))
      await userEvent.type(screen.getByLabelText('Chat message'), 'Hello!{Enter}')

      expect(live.sendLike).toHaveBeenCalledOnce()
      expect(live.setFollowing).toHaveBeenCalledWith(true)
      expect(live.sendChat).toHaveBeenCalledWith('Hello!')
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('lets a signed-in viewer log out, in a narrow window too', async () => {
      watching()
      const session = signedIn()
      render(<App config={config} session={session} device={computer} />)

      await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

      expect(session.logout).toHaveBeenCalledOnce()
    })

    it('shows a signed-in viewer their unread messages, and opens the inbox beside the live', async () => {
      const live = watching()
      render(<App config={config} session={signedIn()} device={computer} />)

      expect(await screen.findByRole('button', { name: 'Inbox, 3 unread' })).toBeInTheDocument()
      act(() => live.inbox.emit({ type: 'unreadCount', count: 0 }))
      await userEvent.click(screen.getByRole('button', { name: 'Inbox' }))

      expect(screen.getByRole('dialog', { name: 'Inbox' })).toBeInTheDocument()
      expect(await screen.findByText('No messages yet')).toBeInTheDocument()
    })

    it('has no inbox without an account', () => {
      watching()
      render(<App config={config} session={signedOut()} device={computer} />)
      expect(screen.queryByRole('button', { name: /^Inbox/ })).not.toBeInTheDocument()
    })

    it('after a minute of watching, asks them to log in - once', () => {
      vi.useFakeTimers()
      watching()
      const { unmount } = render(<App config={config} session={signedOut()} device={computer} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(NUDGE_AFTER_MS)
      })
      expect(screen.getByRole('dialog', { name: "Enjoying Abebe's live?" })).toBeInTheDocument()
      expect(window.sessionStorage.getItem(NUDGE_KEY)).not.toBeNull()

      fireEvent.click(screen.getByRole('button', { name: 'Close' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

      unmount()
      render(<App config={config} session={signedOut()} device={computer} />)
      act(() => {
        vi.advanceTimersByTime(NUDGE_AFTER_MS)
      })
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it("says how the live ended, in the app's words", () => {
    watching({ type: 'ended', reason: 'HOST_ENDED', message: null })
    render(<App config={config} session={signedOut()} device={phone} />)

    expect(screen.getByRole('heading', { name: 'LIVE has ended' })).toBeInTheDocument()
    expect(screen.getByText('Abebe ended the live. Thanks for watching!')).toBeInTheDocument()
  })

  it('shows a stopped live with the reason given', () => {
    watching({ type: 'ended', reason: 'LOCKED', message: 'Breaks the community rules' })
    render(<App config={config} session={signedOut()} device={computer} />)

    expect(screen.getByRole('heading', { name: 'This live was stopped' })).toBeInTheDocument()
    expect(screen.getByText('Breaks the community rules')).toBeInTheDocument()
  })
})
