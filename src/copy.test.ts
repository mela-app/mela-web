import { describe, expect, it } from 'vitest'
import { signupProblems } from './auth/validation'
import { authCopy, endedCopy, installCopy } from './copy'

describe('signupProblems', () => {
  const good = { displayName: 'Abebe', username: 'abebe_1', email: 'abebe@example.com', password: 'secret123' }

  it('passes a good sign-up', () => {
    expect(signupProblems(good)).toEqual({})
  })

  it('applies the same rules as the API', () => {
    expect(signupProblems({ ...good, username: 'ab' }).username).toBeDefined()
    expect(signupProblems({ ...good, username: 'has space' }).username).toBeDefined()
    expect(signupProblems({ ...good, username: 'a'.repeat(25) }).username).toBeDefined()
    expect(signupProblems({ ...good, displayName: '   ' }).displayName).toBe('Enter your name.')
    expect(signupProblems({ ...good, displayName: 'a'.repeat(51) }).displayName).toBeDefined()
    expect(signupProblems({ ...good, email: 'not-an-email' }).email).toBeDefined()
    expect(signupProblems({ ...good, password: 'short12' }).password).toBe('Use at least 8 characters.')
    expect(signupProblems({ ...good, password: 'a'.repeat(73) }).password).toBeDefined()
  })
})

describe('copy', () => {
  it("uses the app's words for how a live ended", () => {
    expect(endedCopy('HOST_ENDED', false, 'Abebe')).toEqual({
      title: 'LIVE has ended',
      body: 'Abebe ended the live. Thanks for watching!',
    })
    expect(endedCopy('LOCKED', false, 'Abebe').title).toBe('This live was stopped')
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
