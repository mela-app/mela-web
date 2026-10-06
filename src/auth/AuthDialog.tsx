import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactElement,
} from 'react'
import { MelaLogo } from '../components/MelaLogo'
import { Modal } from '../components/Modal'
import { ApiError } from '../lib/api'
import type { NewAccountProfile, WebSession } from '../lib/session'
import { GoogleSignInError, type GoogleSignIn } from './googleSignIn'
import { isUsernameAvailable, newAccountProblems, type NewAccountProblems } from './validation'

interface AuthDialogProps {
  session: WebSession
  /** Null until Firebase's web app is set up: new accounts are then made in the app. */
  google: GoogleSignIn | null
  title: string
  body: string
  onSignedIn(): void
  onClose(): void
}

type Availability = 'checking' | 'available' | 'taken' | null

function failureMessage(error: unknown, loggingIn: boolean): string {
  if (error instanceof GoogleSignInError) return error.message
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  if (error.status === 401 && loggingIn) return "That username or email and password don't match."
  if (error.status === 429) return 'Too many tries. Wait a minute, then try again.'
  return error.message
}

/**
 * Log in, or Continue with Google - which signs up someone new after they
 * pick a username (docs/features/auth.md). On computers, where joining in happens here.
 */
export function AuthDialog({ session, google, title, body, onSignedIn, onClose }: AuthDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [login, setLogin] = useState({ usernameOrEmail: '', password: '' })
  // Someone new, after Google: their account's start, theirs to change.
  const [profile, setProfile] = useState<NewAccountProfile | null>(null)
  const [account, setAccount] = useState({ displayName: '', username: '' })
  const [shown, setShown] = useState<NewAccountProblems>({})
  const [availability, setAvailability] = useState<Availability>(null)
  const lookup = useRef(0)

  // Loaded before the click, so the browser lets Google's window open.
  useEffect(() => google?.prepare(), [google])

  const run = async (work: () => Promise<void>, loggingIn = false) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (failure) {
      setError(failureMessage(failure, loggingIn))
    } finally {
      setBusy(false)
    }
  }

  const signedIn = () => {
    void google?.finish()
    onSignedIn()
  }

  const submitLogin = (event: FormEvent) => {
    event.preventDefault()
    if (!login.usernameOrEmail.trim() || !login.password) {
      setError('Enter your username or email and your password.')
      return
    }
    void run(async () => {
      await session.login(login.usernameOrEmail.trim(), login.password)
      onSignedIn()
    }, true)
  }

  const continueWithGoogle = (google: GoogleSignIn) =>
    void run(async () => {
      const token = await google.signIn()
      if (!token) return
      const outcome = await session.continueWithIdentity(token)
      if (outcome.status === 'SIGNED_IN') return signedIn()
      setProfile(outcome.profile)
      setAccount({ displayName: outcome.profile.displayName, username: outcome.profile.suggestedUsername })
      setAvailability('available')
    })

  const changeUsername = (username: string) => {
    setAccount((current) => ({ ...current, username }))
    const query = ++lookup.current
    if (newAccountProblems({ displayName: 'x', username }).username) return setAvailability(null)
    setAvailability('checking')
    window.setTimeout(() => {
      if (query !== lookup.current) return
      isUsernameAvailable(username)
        .then((free) => query === lookup.current && setAvailability(free ? 'available' : 'taken'))
        .catch(() => query === lookup.current && setAvailability(null))
    }, 400)
  }

  const createAccount = (event: FormEvent) => {
    event.preventDefault()
    const problems = newAccountProblems(account)
    setShown(problems)
    if (Object.keys(problems).length > 0 || !google) return
    void run(async () => {
      try {
        await session.createAccount({
          idToken: await google.currentToken(),
          username: account.username,
          displayName: account.displayName.trim(),
        })
      } catch (failure) {
        if (failure instanceof ApiError && failure.code === 'USERNAME_TAKEN') setAvailability('taken')
        else if (failure instanceof ApiError && (failure.code === 'EMAIL_TAKEN' || failure.code === 'ACCOUNT_EXISTS')) {
          setProfile(null)
        }
        throw failure
      }
      signedIn()
    })
  }

  const cancelNewAccount = () => {
    void google?.finish()
    setProfile(null)
    setError(null)
    setShown({})
  }

  if (profile) {
    const usernameProblem = shown.username ?? (availability === 'taken' ? 'That username is taken. Try another.' : undefined)
    return (
      <Modal labelledBy="auth-title" onClose={onClose}>
        <MelaLogo className="sheet-logo" />
        <h2 id="auth-title">Choose your username</h2>
        <p className="modal-body">It&apos;s how people find and mention you on Mela. Signing up as {profile.email}.</p>
        <form className="auth-form" onSubmit={createAccount} noValidate>
          <Field label="Name" problem={shown.displayName}>
            <input
              name="name"
              autoComplete="name"
              maxLength={50}
              value={account.displayName}
              onChange={(event) => setAccount({ ...account, displayName: event.target.value })}
            />
          </Field>
          <Field
            label="Username"
            problem={usernameProblem}
            note={availability === 'available' ? 'Available' : availability === 'checking' ? 'Checking…' : undefined}
          >
            <input
              name="username"
              autoComplete="username"
              maxLength={24}
              value={account.username}
              onChange={(event) => changeUsername(event.target.value)}
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy || availability === 'taken'}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>
          <button type="button" className="btn btn-text btn-block" onClick={cancelNewAccount} disabled={busy}>
            Cancel
          </button>
        </form>
      </Modal>
    )
  }

  return (
    <Modal labelledBy="auth-title" onClose={onClose}>
      <MelaLogo className="sheet-logo" />
      <h2 id="auth-title">{title}</h2>
      <p className="modal-body">{body}</p>

      {google ? (
        <button type="button" className="btn btn-google btn-block" disabled={busy} onClick={() => continueWithGoogle(google)}>
          <GoogleMark /> Continue with Google
        </button>
      ) : (
        <p className="auth-note">New to Mela? Sign up in the app, then log in here.</p>
      )}
      <p className="auth-divider">
        <span>or log in with your password</span>
      </p>

      <form className="auth-form" onSubmit={submitLogin} noValidate>
        <Field label="Username or email">
          <input
            name="username"
            autoComplete="username"
            value={login.usernameOrEmail}
            onChange={(event) => setLogin({ ...login, usernameOrEmail: event.target.value })}
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            value={login.password}
            onChange={(event) => setLogin({ ...login, password: event.target.value })}
          />
        </Field>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </Modal>
  )
}

function Field({
  label,
  problem,
  note,
  children,
}: {
  label: string
  problem?: string
  note?: string
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>
}) {
  const id = useId()
  const hint = problem ?? note
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {cloneElement(children, {
        id,
        'aria-describedby': hint ? `${id}-hint` : undefined,
        'aria-invalid': problem ? true : undefined,
      })}
      {hint && (
        <span id={`${id}-hint`} className={problem ? 'field-problem' : 'field-note'}>
          {hint}
        </span>
      )}
    </div>
  )
}

// Google's "G", for its sign-in button.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}
