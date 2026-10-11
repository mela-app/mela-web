import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../lib/api'
import type { IdentityOutcome, WebSession } from '../lib/session'
import { AuthDialog } from './AuthDialog'
import type { GoogleSignIn } from './googleSignIn'

vi.mock('./validation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./validation')>()),
  isUsernameAvailable: vi.fn(async (username: string) => username !== 'taken_name'),
}))

const newcomer: IdentityOutcome = {
  status: 'NEEDS_ACCOUNT',
  profile: { email: 'abebe@gmail.com', displayName: 'Abebe Kebede', suggestedUsername: 'abebe_kebede' },
}

function setup({
  session = {},
  google = fakeGoogle(),
}: {
  session?: Partial<Pick<WebSession, 'login' | 'continueWithIdentity' | 'createAccount' | 'legalInfo'>>
  google?: GoogleSignIn | null
} = {}) {
  const fake = {
    login: vi.fn(async () => undefined),
    continueWithIdentity: vi.fn(async (): Promise<IdentityOutcome> => ({ status: 'SIGNED_IN' })),
    createAccount: vi.fn(async () => undefined),
    legalInfo: vi.fn(async () => ({ version: '2026-10-12', minimumAge: 18 })),
    ...session,
  }
  const onSignedIn = vi.fn()
  const onClose = vi.fn()
  render(
    <AuthDialog
      session={fake as unknown as WebSession}
      google={google}
      title="Log in to chat with Abebe"
      body="Watching is free."
      onSignedIn={onSignedIn}
      onClose={onClose}
    />,
  )
  return { session: fake, google, onSignedIn, onClose, user: userEvent.setup() }
}

function fakeGoogle(token: string | null = 'google-token') {
  return {
    prepare: vi.fn(),
    signIn: vi.fn(async () => token),
    currentToken: vi.fn(async () => 'fresh-token'),
    finish: vi.fn(async () => undefined),
  } satisfies GoogleSignIn
}

// The age step: a date of birth and the Terms agreed to.
async function passAboutYou(user: ReturnType<typeof userEvent.setup>, birthDate = '1995-04-20') {
  expect(screen.getByRole('heading', { name: "When's your birthday?" })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: birthDate } })
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('AuthDialog', () => {
  beforeEach(() => window.localStorage.clear())

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
      session: {
        login: vi.fn(async () => {
          throw new ApiError(401, 'Invalid credentials')
        }),
      },
    })

    await user.type(screen.getByLabelText('Username or email'), 'abebe')
    await user.type(screen.getByLabelText('Password'), 'wrong-password')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("That username or email and password don't match.")
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('loads Google sign-in ahead of the click', () => {
    const { google } = setup()
    expect(google?.prepare).toHaveBeenCalled()
  })

  it('continues with Google straight into an existing account', async () => {
    const { session, google, onSignedIn, user } = setup()

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(session.continueWithIdentity).toHaveBeenCalledWith('google-token')
    expect(onSignedIn).toHaveBeenCalledOnce()
    expect(google?.finish).toHaveBeenCalled()
  })

  it('lets someone new pick a username, then makes their account', async () => {
    const { session, google, onSignedIn, user } = setup({
      session: { continueWithIdentity: vi.fn(async () => newcomer) },
    })

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await passAboutYou(user)

    expect(screen.getByRole('heading', { name: 'Choose your username' })).toBeInTheDocument()
    expect(screen.getByText(/abebe@gmail\.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Abebe Kebede')
    expect(screen.getByLabelText('Username')).toHaveValue('abebe_kebede')

    await user.clear(screen.getByLabelText('Username'))
    await user.type(screen.getByLabelText('Username'), 'abebe')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(session.createAccount).toHaveBeenCalledWith({
      idToken: 'fresh-token',
      username: 'abebe',
      displayName: 'Abebe Kebede',
      birthDate: '1995-04-20',
      acceptedLegalVersion: '2026-10-12',
    })
    expect(onSignedIn).toHaveBeenCalledOnce()
    expect(google?.finish).toHaveBeenCalled()
  })

  it('says when a username is taken, before and after sending it', async () => {
    const { session, user } = setup({
      session: {
        continueWithIdentity: vi.fn(async () => newcomer),
        createAccount: vi.fn(async () => {
          throw new ApiError(409, 'That username is taken. Try another.', 'USERNAME_TAKEN')
        }),
      },
    })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await passAboutYou(user)

    await user.clear(screen.getByLabelText('Username'))
    await user.type(screen.getByLabelText('Username'), 'taken_name')
    expect(await screen.findByText('That username is taken. Try another.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()

    await user.clear(screen.getByLabelText('Username'))
    await user.type(screen.getByLabelText('Username'), 'abebe_2')
    expect(await screen.findByText('Available')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(session.createAccount).toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('That username is taken. Try another.')
  })

  it('checks the name and username before sending them', async () => {
    const { session, user } = setup({ session: { continueWithIdentity: vi.fn(async () => newcomer) } })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await passAboutYou(user)

    await user.clear(screen.getByLabelText('Name'))
    await user.clear(screen.getByLabelText('Username'))
    await user.type(screen.getByLabelText('Username'), 'ab')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('3-24 letters, numbers or underscores.')).toBeInTheDocument()
    expect(session.createAccount).not.toHaveBeenCalled()
  })

  it('backs out of a new account, and Firebase forgets the Google account', async () => {
    const { google, user } = setup({ session: { continueWithIdentity: vi.fn(async () => newcomer) } })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(google?.finish).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  it('asks a date of birth and the Terms first - without hinting at the age needed', async () => {
    const { session, user } = setup({ session: { continueWithIdentity: vi.fn(async () => newcomer) } })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(screen.queryByText(/18/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByText('Enter your date of birth')).toBeInTheDocument()
    expect(screen.getByText('Please agree to continue.')).toBeInTheDocument()
    expect(session.createAccount).not.toHaveBeenCalled()
  })

  it('too young: no account, Firebase forgets them, and this browser waits a day', async () => {
    const { session, google, user } = setup({ session: { continueWithIdentity: vi.fn(async () => newcomer) } })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const year = new Date().getFullYear() - 17
    await passAboutYou(user, `${year}-01-01`)

    expect(screen.getByRole('heading', { name: "Sorry, you can't use Mela" })).toBeInTheDocument()
    expect(google?.finish).toHaveBeenCalled()
    expect(session.createAccount).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('mela.ageGate.lockedUntil')).not.toBeNull()
  })

  it("the API's own age check ends it the same way", async () => {
    const { user } = setup({
      session: {
        continueWithIdentity: vi.fn(async () => newcomer),
        createAccount: vi.fn(async () => {
          throw new ApiError(403, 'Mela is only for people 18 or older.', 'UNDER_AGE')
        }),
      },
    })
    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))
    await passAboutYou(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('heading', { name: "Sorry, you can't use Mela" })).toBeInTheDocument()
  })

  it('does nothing when the Google window is closed', async () => {
    const { session, onSignedIn, user } = setup({ google: fakeGoogle(null) })

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    expect(session.continueWithIdentity).not.toHaveBeenCalled()
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('sends new people to the app when Google sign-in is not set up', () => {
    setup({ google: null })

    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()
    expect(screen.getByText('New to Mela? Sign up in the app, then log in here.')).toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { onClose, user } = setup()
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })
})
