import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerConfig } from '../config'
import { installUrl, liveUrl, openApp, openInAppUrl } from './appLinks'
import { detectDevice } from './device'
import { compactCount, initials } from './format'
import { qrPath } from './qr'

const config: PlayerConfig = {
  streamId: 'live-1',
  appScheme: 'gamblinglive',
  androidPackage: 'com.gamblinglive.app',
  androidInstallUrl: 'https://play.google.com/store/apps/details?id=com.gamblinglive.app',
  iosInstallUrl: 'https://apps.apple.com/app/id1',
}

describe('app links', () => {
  it('uses an intent link on Android, which goes to the store by itself when the app is missing', () => {
    expect(openInAppUrl(config, 'android')).toBe(
      'intent://live/live-1#Intent;scheme=gamblinglive;package=com.gamblinglive.app;' +
        'S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.gamblinglive.app;end',
    )
  })

  it("uses the app's own scheme elsewhere", () => {
    expect(openInAppUrl(config, 'ios')).toBe('gamblinglive://live/live-1')
  })

  it('knows where to get the app on each phone', () => {
    expect(installUrl(config, 'android')).toBe(config.androidInstallUrl)
    expect(installUrl(config, 'ios')).toBe(config.iosInstallUrl)
    expect(installUrl(config, 'other')).toBeNull()
    expect(liveUrl(config, 'https://api.example')).toBe('https://api.example/live/live-1')
  })

  describe('openApp', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    const fakeWindow = (visibilityState: DocumentVisibilityState) =>
      ({
        location: { href: '' },
        document: { visibilityState },
        setTimeout: (run: () => void, ms: number) => window.setTimeout(run, ms),
      }) as unknown as Window

    it('sends iOS on to the App Store when the app did not open', () => {
      vi.useFakeTimers()
      const win = fakeWindow('visible')
      openApp(config, 'ios', win)
      expect(win.location.href).toBe('gamblinglive://live/live-1')
      vi.advanceTimersByTime(1500)
      expect(win.location.href).toBe(config.iosInstallUrl)
    })

    it('leaves it be when the app opened (the page went to the background)', () => {
      vi.useFakeTimers()
      const win = fakeWindow('hidden')
      openApp(config, 'ios', win)
      vi.advanceTimersByTime(1500)
      expect(win.location.href).toBe('gamblinglive://live/live-1')
    })
  })
})

describe('detectDevice', () => {
  const macSafari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

  it('tells phones apart', () => {
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
    const iphone =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    expect(detectDevice({ userAgent: android, maxTouchPoints: 5 })).toEqual({ platform: 'android', mobile: true })
    expect(detectDevice({ userAgent: iphone, maxTouchPoints: 5 })).toEqual({ platform: 'ios', mobile: true })
  })

  it('sees through an iPad asking for the desktop site', () => {
    expect(detectDevice({ userAgent: macSafari, maxTouchPoints: 5 })).toEqual({ platform: 'ios', mobile: true })
  })

  it('treats computers as computers', () => {
    const windows = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    expect(detectDevice({ userAgent: macSafari, maxTouchPoints: 0 })).toEqual({ platform: 'other', mobile: false })
    expect(detectDevice({ userAgent: windows, maxTouchPoints: 0 })).toEqual({ platform: 'other', mobile: false })
  })
})

describe('format', () => {
  it('shortens counts the way the app does', () => {
    expect(compactCount(999)).toBe('999')
    expect(compactCount(1000)).toBe('1K')
    expect(compactCount(1299)).toBe('1.2K')
    expect(compactCount(12_345)).toBe('12K')
    expect(compactCount(1_560_000)).toBe('1.5M')
  })

  it('takes up to two initials', () => {
    expect(initials('Abebe Kebede Tesfaye')).toBe('AK')
    expect(initials('selam')).toBe('S')
    expect(initials('   ')).toBe('?')
  })
})

describe('qrPath', () => {
  it('draws each run of dark modules as one rectangle', () => {
    expect(
      qrPath([
        [true, true, false, true],
        [false, false, false, false],
        [false, true, true, true],
      ]),
    ).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM1 2h3v1h-3z')
  })
})
