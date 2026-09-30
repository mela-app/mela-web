import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { WebSession } from '../lib/session'
import { AuthDialog } from './AuthDialog'

function setup(session: Partial<Pick<WebSession, 'login' | 'signup'>> = {}) {
  const fake = {
    login: vi.fn(async () => undefined),
    signup: vi.fn(async () => undefined),
    ...session,
  }
  const onSignedIn = vi.fn()
  const onClose = vi.fn()
  render(
    <AuthDialog
      session={fake as unknown as WebSession}
      title="Log in to chat with Abebe"
      body="Watching is free."
      onSignedIn={onSignedIn}
      onClose={onClose}
    />,
  )
  return { session: fake, onSignedIn, onClose, user: userEvent.setup() }
}

describe('AuthDialog', () => {
  it('logs in and hands back to the live', async () => {
    const { session, onSignedIn, user } = setup()
    expect(screen.getByRole('dialog', { name: 'Log in to chat with Abebe' })).toBeInTheDocument()

    await user.type(screen.getByLabelText('Username or email'), ' abebe ')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(session.login).toHaveBeenCalledWith('abebe', 'secret123')
    expect(onSignedIn).toHaveBeenCalledOnce()
  })

  it('says so when the details are wrong', async () => {
    const { onSignedIn, user } = setup({
      login: vi.fn(async () => {
        throw new ApiError(401, 'Invalid credentials')
      }),
    })

    await user.type(screen.getByLabelText('Username or email'), 'abebe')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That username or email and password don't match.")
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('checks a sign-up before sending it', async () => {
    const { session, user } = setup()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))

    await user.type(screen.getByLabelText('Username'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('3-24 letters, numbers or underscores.')).toBeInTheDocument()
    expect(session.signup).not.toHaveBeenCalled()
  })

  it('signs up', async () => {
    const { session, onSignedIn, user } = setup()
    await user.click(screen.getByRole('tab', { name: 'Sign up' }))

    await user.type(screen.getByLabelText('Name'), ' Abebe ')
    await user.type(screen.getByLabelText('Username'), 'abebe_1')
    await user.type(screen.getByLabelText('Email'), 'abebe@example.com')
    await user.type(screen.getByLabelText('Password'), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(session.signup).toHaveBeenCalledWith({
      displayName: 'Abebe',
      username: 'abebe_1',
      email: 'abebe@example.com',
      password: 'secret123',
    })
    expect(onSignedIn).toHaveBeenCalledOnce()
  })

  it('closes on Escape', async () => {
    const { onClose, user } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
