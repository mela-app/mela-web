import { describe, expect, it } from 'vitest'
import { newAccountProblems } from './auth/validation'
import { authCopy, endedCopy, installCopy } from './copy'

describe('newAccountProblems', () => {
  const good = { displayName: 'Abebe', username: 'abebe_1' }

  it('passes a good new account', () => {
    expect(newAccountProblems(good)).toEqual({})
  })

  it('applies the same rules as the API', () => {
    expect(newAccountProblems({ ...good, username: 'ab' }).username).toBeDefined()
    expect(newAccountProblems({ ...good, username: 'has space' }).username).toBeDefined()
    expect(newAccountProblems({ ...good, username: 'a'.repeat(25) }).username).toBeDefined()
    expect(newAccountProblems({ ...good, displayName: '   ' }).displayName).toBe('Enter your name.')
    expect(newAccountProblems({ ...good, displayName: 'a'.repeat(51) }).displayName).toBeDefined()
  })
})

describe('copy', () => {
  it("uses the app's words for how a live ended", () => {
    expect(endedCopy('HOST_ENDED', false, 'Abebe')).toEqual({
      title: 'LIVE has ended',
      body: 'Abebe ended the live. Thanks for watching!',
    })
    expect(endedCopy('LOCKED', false, 'Abebe').title).toBe('This live was stopped')
    expect(endedCopy('HOST_RESTRICTED', false, 'Abebe')).toEqual(endedCopy('LOCKED', false, 'Abebe'))
    expect(endedCopy('SOMETHING_NEW', false, null).body).toBe('This live is over. Thanks for watching!')
    expect(endedCopy(null, true, null)).toEqual({
      title: 'Removed from stream',
      body: 'The host removed you from this stream.',
    })
  })

  it('says what the prompt is for', () => {
    expect(installCopy('chat', 'Abebe').title).toBe('Chat with Abebe in the app')
    expect(installCopy('stage', 'Abebe').title).toBe('Join the stage from the app')
    expect(authCopy('follow', 'Abebe').title).toBe('Log in to follow Abebe')
    expect(authCopy('timed', 'Abebe').title).toBe("Enjoying Abebe's live?")
  })
})
