/** What the share page tells the player (backend: share/web-fallback.controller.ts). */
export interface PlayerConfig {
  streamId: string
  appScheme: string
  androidPackage: string
  androidInstallUrl: string
  iosInstallUrl: string | null
}

const filled = (value: unknown): value is string => typeof value === 'string' && value.length > 0

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
      return { streamId, appScheme, androidPackage, androidInstallUrl, iosInstallUrl }
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
  return {
    streamId,
    appScheme,
    androidPackage,
    androidInstallUrl: `https://play.google.com/store/apps/details?id=${encodeURIComponent(androidPackage)}`,
    iosInstallUrl: null,
  }
}
