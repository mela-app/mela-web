import { useState, type FormEvent, type ReactNode } from 'react'
import { MelaLogo } from '../components/MelaLogo'
import { Modal } from '../components/Modal'
import { ApiError } from '../lib/api'
import type { SignupFields, WebSession } from '../lib/session'
import { signupProblems, type SignupProblems } from './validation'

type Tab = 'login' | 'signup'

interface AuthDialogProps {
  session: WebSession
  title: string
  body: string
  onSignedIn(): void
  onClose(): void
}

function failureMessage(error: unknown, tab: Tab): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.'
  if (error.status === 401 && tab === 'login') return "That username or email and password don't match."
  if (error.status === 429) return 'Too many tries. Wait a minute, then try again.'
  if (error.status === 409) return 'That username or email is already taken.'
  return error.message
}

/** Log in or sign up, right on the page - on computers, where joining in happens here. */
export function AuthDialog({ session, title, body, onSignedIn, onClose }: AuthDialogProps) {
  const [tab, setTab] = useState<Tab>('login')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [login, setLogin] = useState({ usernameOrEmail: '', password: '' })
  const [signup, setSignup] = useState<SignupFields>({ displayName: '', username: '', email: '', password: '' })
  const [shown, setShown] = useState<SignupProblems>({})

  const switchTo = (next: Tab) => {
    setTab(next)
    setError(null)
    setShown({})
  }

  const run = async (work: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      onSignedIn()
    } catch (failure) {
      setError(failureMessage(failure, tab))
      setBusy(false)
    }
  }

  const submitLogin = (event: FormEvent) => {
    event.preventDefault()
    if (!login.usernameOrEmail.trim() || !login.password) {
      setError('Enter your username or email and your password.')
      return
    }
    void run(() => session.login(login.usernameOrEmail.trim(), login.password))
  }

  const submitSignup = (event: FormEvent) => {
    event.preventDefault()
    const problems = signupProblems(signup)
    setShown(problems)
    if (Object.keys(problems).length > 0) return
    void run(() =>
      session.signup({
        displayName: signup.displayName.trim(),
        username: signup.username,
        email: signup.email.trim(),
        password: signup.password,
      }),
    )
  }

  return (
    <Modal labelledBy="auth-title" onClose={onClose}>
      <MelaLogo className="sheet-logo" />
      <h2 id="auth-title">{title}</h2>
      <p className="modal-body">{body}</p>

      <div className="tabs" role="tablist" aria-label="Log in or sign up">
        <button type="button" role="tab" aria-selected={tab === 'login'} onClick={() => switchTo('login')}>
          Log in
        </button>
        <button type="button" role="tab" aria-selected={tab === 'signup'} onClick={() => switchTo('signup')}>
          Sign up
        </button>
      </div>

      {tab === 'login' ? (
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
      ) : (
        <form className="auth-form" onSubmit={submitSignup} noValidate>
          <Field label="Name" problem={shown.displayName}>
            <input
              name="name"
              autoComplete="name"
              maxLength={50}
              value={signup.displayName}
              onChange={(event) => setSignup({ ...signup, displayName: event.target.value })}
            />
          </Field>
          <Field label="Username" problem={shown.username}>
            <input
              name="username"
              autoComplete="username"
              maxLength={24}
              value={signup.username}
              onChange={(event) => setSignup({ ...signup, username: event.target.value })}
            />
          </Field>
          <Field label="Email" problem={shown.email}>
            <input
              name="email"
              type="email"
              autoComplete="email"
              value={signup.email}
              onChange={(event) => setSignup({ ...signup, email: event.target.value })}
            />
          </Field>
          <Field label="Password" problem={shown.password}>
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              maxLength={72}
              value={signup.password}
              onChange={(event) => setSignup({ ...signup, password: event.target.value })}
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>
        </form>
      )}
    </Modal>
  )
}

function Field({ label, problem, children }: { label: string; problem?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {problem && <span className="field-problem">{problem}</span>}
    </label>
  )
}
