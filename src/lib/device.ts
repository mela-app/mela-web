export type Platform = 'android' | 'ios' | 'other'

export interface Device {
  platform: Platform
  /** A phone or tablet: the app is the way on; on a computer, it's signing in here. */
  mobile: boolean
  /**
   * Another app's own browser - TikTok's, where Mela's links arrive. It
   * can't open apps, so "Open in Mela" goes to the get-the-app page
   * instead (backend: share-page.ts inAppBrowser).
   */
  inApp: boolean
}

// TikTok, Instagram, Facebook, Snapchat, Telegram.
const IN_APP_BROWSER = /musical_ly|Bytedance|TikTok|trill_|Instagram|FBAN|FBAV|FB_IAB|Snapchat|Telegram/i

export function detectDevice(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): Device {
  const agent = nav.userAgent
  // iPadOS asks for the desktop site: it passes for a Mac, but a touch one.
  const ios = /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && nav.maxTouchPoints > 1)
  const android = /Android/i.test(agent)
  return {
    platform: ios ? 'ios' : android ? 'android' : 'other',
    mobile: ios || android || /Mobi/i.test(agent),
    inApp: IN_APP_BROWSER.test(agent) || (android && /; wv\)/.test(agent)),
  }
}
