/** Firebase's public web settings, for Continue with Google (backend: share/web-fallback.controller.ts). */
export interface FirebaseWebConfig {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
}

/** What the share page tells the player (backend: share/web-fallback.controller.ts). */
export interface PlayerConfig {
  streamId: string
  appScheme: string
  androidPackage: string
  androidInstallUrl: string
  iosInstallUrl: string | null
  /** Absent until Firebase's web app is set up: signing up then happens in the app. */
  firebase?: FirebaseWebConfig
}

const filled = (value: unknown): value is string => typeof value === 'string' && value.length > 0

function firebaseOf(value: unknown): FirebaseWebConfig | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { apiKey, authDomain, projectId, appId } = value as Partial<Record<keyof FirebaseWebConfig, unknown>>
  if (!filled(apiKey) || !filled(authDomain) || !filled(projectId) || !filled(appId)) return undefined
  return { apiKey, authDomain, projectId, appId }
}

/**
 * The page's settings, from the JSON the share page embeds - or, on Vite's
 * development page, the live named in `?stream=` with the app's identifiers
 * from .env. Null when there's no live to play or a setting is missing.
 */
export function readPlayerConfig(doc: Document, location: Pick<Location, 'search'>): PlayerConfig | null {
  const embedded = doc.getElementById('mela-player-config')?.textContent
  if (embedded) {
    try {
      const config = JSON.parse(embedded) as Partial<PlayerConfig>
      const { streamId, appScheme, androidPackage, androidInstallUrl, iosInstallUrl } = config
      if (!filled(streamId) || !filled(appScheme) || !filled(androidPackage) || !filled(androidInstallUrl)) return null
      if (iosInstallUrl !== null && !filled(iosInstallUrl)) return null
      const firebase = firebaseOf(config.firebase)
      return { streamId, appScheme, androidPackage, androidInstallUrl, iosInstallUrl, ...(firebase && { firebase }) }
    } catch {
      return null
    }
  }
  // Development only: production builds drop this branch, and its settings with it.
  if (!import.meta.env.DEV) return null
  const streamId = new URLSearchParams(location.search).get('stream')
  const appScheme = import.meta.env.VITE_APP_URL_SCHEME
  const androidPackage = import.meta.env.VITE_ANDROID_APP_PACKAGE_NAME
  if (!streamId || !filled(appScheme) || !filled(androidPackage)) return null
  const env = import.meta.env
  const firebase = firebaseOf({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  })
  return {
    streamId,
    appScheme,
    androidPackage,
    androidInstallUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}`,
    iosInstallUrl: null,
    ...(firebase && { firebase }),
  }
}
