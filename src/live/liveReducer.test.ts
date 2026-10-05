import { describe, expect, it } from 'vitest'
import { initialLiveState, liveReducer, MAX_MESSAGES, type LiveState } from './liveReducer'
import type { ChatMessage, WatchResponse } from './types'

const host = { id: 'host-1', username: 'abebe', displayName: 'Abebe', avatarUrl: null }
const watch: WatchResponse = {
  stream: { id: 'live-1', title: 'Friday night', hostId: host.id, host, channelName: 'channel-1' },
  rtcToken: { provider: 'LIVEKIT', url: 'wss://video.example', token: 'video-token' },
  watchTicket: 'ticket',
  isFollowingHost: true,
  pinnedMessage: { id: 'm-1', text: 'Welcome', senderName: 'Abebe' },
  activeGuests: [{ ...host, id: 'guest-1', agoraUid: 7 }],
  hostAgoraUid: 1,
}

const message = (id: string): ChatMessage => ({ id, text: `hi ${id}`, createdAt: '2026-01-01T00:00:00Z', sender: host })
const playing = (): LiveState => liveReducer(initialLiveState, { type: 'watching', watch })

describe('liveReducer', () => {
  it('starts playing with what the watch call returned', () => {
    expect(playing()).toMatchObject({
      phase: 'live',
      pinned: watch.pinnedMessage,
      guests: watch.activeGuests,
      isFollowingHost: true,
    })
  })

  it('shows each chat message once, keeping only the latest ones', () => {
    let state = liveReducer(playing(), { type: 'chatNew', message: message('a') })
    state = liveReducer(state, { type: 'chatNew', message: message('a') })
    expect(state.messages.map((item) => item.id)).toEqual(['a'])

    const many = Array.from({ length: MAX_MESSAGES + 5 }, (_, index) => message(`m${index}`))
    state = liveReducer(state, { type: 'chatSnapshot', messages: many })
    expect(state.messages).toHaveLength(MAX_MESSAGES)
    expect(state.messages.at(-1)?.id).toBe(`m${MAX_MESSAGES + 4}`)
  })

  it('unpins a message that was deleted', () => {
    let state = liveReducer(playing(), { type: 'chatSnapshot', messages: [message('m-1')] })
    state = liveReducer(state, { type: 'chatDeleted', messageId: 'm-1' })
    expect(state.messages).toEqual([])
    expect(state.pinned).toBeNull()
  })

  it('never lets the like total go backwards', () => {
    let state = liveReducer(playing(), { type: 'likes', total: 10 })
    state = liveReducer(state, { type: 'likes', total: 4 })
    expect(state.likeCount).toBe(10)
  })

  it('replaces a guest who joins again, and drops one who leaves', () => {
    let state = liveReducer(playing(), { type: 'guestJoined', guest: { ...host, id: 'guest-1', agoraUid: 9 } })
    expect(state.guests).toEqual([{ ...host, id: 'guest-1', agoraUid: 9 }])
    state = liveReducer(state, { type: 'guestLeft', userId: 'guest-1' })
    expect(state.guests).toEqual([])
  })

  it('moves a guest where the host put them, and back in line', () => {
    const placement = { x: 0, y: 1, size: 0.4 }
    let state = liveReducer(playing(), { type: 'guestPlaced', userId: 'guest-1', placement })
    expect(state.guests[0].placement).toEqual(placement)
    state = liveReducer(state, { type: 'guestPlaced', userId: 'guest-1', placement: null })
    expect(state.guests[0].placement).toBeNull()
  })

  it('takes the room as the server has it', () => {
    const state = liveReducer(playing(), {
      type: 'room',
      state: { viewerCount: 12, likeCount: 40, paused: true, hostAway: false, moderatorIds: ['mod-1'] },
    })
    expect(state).toMatchObject({ viewerCount: 12, likeCount: 40, paused: true, moderatorIds: ['mod-1'] })
  })

  it('remembers why the live ended', () => {
    const state = liveReducer(playing(), { type: 'ended', reason: 'LOCKED', message: 'Against the rules' })
    expect(state).toMatchObject({ phase: 'ended', endedReason: 'LOCKED', endedMessage: 'Against the rules' })
  })

  it('goes back to loading on a retry', () => {
    const failed = liveReducer(initialLiveState, { type: 'failed', error: 'Nope' })
    expect(failed).toMatchObject({ phase: 'error', error: 'Nope' })
    expect(liveReducer(failed, { type: 'retry' })).toMatchObject({ phase: 'loading', error: null })
  })
})
