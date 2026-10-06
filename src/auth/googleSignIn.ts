import type { FirebaseWebConfig } from '../config'

/**
 * Continue with Google on the web (docs/features/auth.md): Firebase proves the
 * Google account, then the API signs the person in or makes their account.
 * Firebase only proves it - nothing of it is kept in the browser.
 */
export interface GoogleSignIn {
  /** Loads the sign-in code ahead of the click, so the browser lets its popup open. */
  prepare(): void
  /** Google's account picker; a token proving the chosen account, or null when it was closed. */
  signIn(): Promise<string | null>
  /** A fresh token for the account just picked. */
  currentToken(): Promise<string>
  /** Firebase forgets the person: Mela has the account now. */
  finish(): Promise<void>
}

/** Worded for the person: what went wrong with Google sign-in. */
export class GoogleSignInError extends Error {}

type FirebaseAuth = import('firebase/auth').Auth
type Firebase = typeof import('firebase/auth')

export function firebaseGoogleSignIn(config: FirebaseWebConfig): GoogleSignIn {
  let loading: Promise<{ auth: FirebaseAuth; firebase: Firebase }> | null = null
  let ready: { auth: FirebaseAuth; firebase: Firebase } | null = null

  // Its own chunk: most visitors only watch.
  const load = () =>
    (loading ??= (async () => {
      const [{ initializeApp }, firebase] = await Promise.all([import('firebase/app'), import('firebase/auth')])
      const app = initializeApp(config, 'mela-web')
      const auth = firebase.initializeAuth(app, {
        persistence: firebase.inMemoryPersistence,
        popupRedirectResolver: firebase.browserPopupRedirectResolver,
      })
      ready = { auth, firebase }
      return ready
    })().catch((error: unknown) => {
      loading = null
      throw error
    }))

  return {
    prepare: () => void load().catch(() => undefined),

    async signIn() {
      // Straight from the click once loaded: browsers only let a popup open from one.
      const { auth, firebase } = ready ?? (await load())
      try {
        const credential = await firebase.signInWithPopup(auth, new firebase.GoogleAuthProvider())
        return await credential.user.getIdToken()
      } catch (error) {
        const code = (error as { code?: unknown }).code
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return null
        throw new GoogleSignInError(messageFor(code))
      }
    },

    async currentToken() {
      const user = (ready ?? (await load())).auth.currentUser
      if (!user) throw new GoogleSignInError('That took too long. Please continue with Google again.')
      return user.getIdToken(true)
    },

    async finish() {
      const user = ready?.auth.currentUser
      if (!ready || !user) return
      await user.delete().catch(() => undefined)
      await ready.auth.signOut().catch(() => undefined)
    },
  }
}

function messageFor(code: unknown): string {
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google window. Allow pop-ups for this page, then try again.'
    case 'auth/network-request-failed':
      return "Can't reach Google right now. Check your connection."
    case 'auth/unauthorized-domain':
    case 'auth/operation-not-allowed':
    case 'auth/invalid-api-key':
      return "Google sign-in isn't set up for this page yet."
    default:
      return "Couldn't sign in with Google. Try again."
  }
}
