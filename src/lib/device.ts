export type Platform = 'android' | 'ios' | 'other'

export interface Device {
  platform: Platform
  /** A phone or tablet: the app is the way on; on a computer, it's signing in here. */
  mobile: boolean
}

export function detectDevice(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>): Device {
  const agent = nav.userAgent
  // iPadOS asks for the desktop site: it passes for a Mac, but a touch one.
  const ios = /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && nav.maxTouchPoints > 1)
  const android = /Android/i.test(agent)
  return {
    platform: ios ? 'ios' : android ? 'android' : 'other',
    mobile: ios || android || /Mobi/i.test(agent),
  }
}
