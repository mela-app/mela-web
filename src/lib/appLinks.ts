import type { PlayerConfig } from '../config'
import type { Platform } from './device'

// How long iOS gets to switch to the app before we assume it isn't installed.
const IOS_OPEN_GRACE_MS = 1500

/**
 * This live in the app. On Android an intent link, which goes to the install
 * page by itself when the app isn't there; elsewhere the app's own scheme.
 */
export function openInAppUrl(config: PlayerConfig, platform: Platform): string {
  const path = `live/${encodeURIComponent(config.streamId)}`
  if (platform === 'android') {
    const fallback = encodeURIComponent(config.androidInstallUrl)
    return `intent://${path}#Intent;scheme=${config.appScheme};package=${config.androidPackage};S.browser_fallback_url=${fallback};end`
  }
  return `${config.appScheme}://${path}`
}

/** Where to get the app on this phone - null when there's nowhere set. */
export function installUrl(config: PlayerConfig, platform: Platform): string | null {
  if (platform === 'android') return config.androidInstallUrl
  if (platform === 'ios') return config.iosInstallUrl
  return null
}

/** This live's page: the link to share, and what the QR code opens. */
export function liveUrl(config: PlayerConfig, origin: string): string {
  return `${origin}/live/${encodeURIComponent(config.streamId)}`
}

/** Opens the app; on iOS, the install page too if nothing opened meanwhile. */
export function openApp(config: PlayerConfig, platform: Platform, win: Window = window): void {
  win.location.href = openInAppUrl(config, platform)
  const install = installUrl(config, platform)
  if (platform !== 'ios' || !install) return
  win.setTimeout(() => {
    if (win.document.visibilityState === 'visible') win.location.href = install
  }, IOS_OPEN_GRACE_MS)
}
