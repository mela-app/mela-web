import { describe, expect, it, vi } from 'vitest'
import { readPlayerConfig } from './config'

function sharePage(json?: string): Document {
  const doc = document.implementation.createHTMLDocument('share')
  if (json !== undefined) {
    const script = doc.createElement('script')
    script.id = 'mela-player-config'
    script.type = 'application/json'
    script.textContent = json
    doc.body.append(script)
  }
  return doc
}

const noQuery = { search: '' }

describe('readPlayerConfig', () => {
  const embedded = {
    streamId: 'live-1',
    appScheme: 'mela',
    androidPackage: 'com.mela.app',
    androidInstallUrl: 'https://play.example/mela',
    iosInstallUrl: 'https://apps.example/mela',
  }

  it('reads what the share page embeds', () => {
    expect(readPlayerConfig(sharePage(JSON.stringify(embedded)), noQuery)).toEqual(embedded)
    const noIosListing = { ...embedded, iosInstallUrl: null }
    expect(readPlayerConfig(sharePage(JSON.stringify(noIosListing)), noQuery)).toEqual(noIosListing)
  })

  it('has no built-in settings: a page that leaves one out plays nothing', () => {
    expect(readPlayerConfig(sharePage('{"streamId":"live-1"}'), noQuery)).toBeNull()
    const noScheme = JSON.stringify({ ...embedded, appScheme: undefined })
    expect(readPlayerConfig(sharePage(noScheme), noQuery)).toBeNull()
  })

  it('plays nothing without a live, or when the page data is broken', () => {
    expect(readPlayerConfig(sharePage('{"streamId":""}'), noQuery)).toBeNull()
    expect(readPlayerConfig(sharePage('{not json'), noQuery)).toBeNull()
    expect(readPlayerConfig(sharePage(), noQuery)).toBeNull()
  })

  it("takes the live from ?stream= on the development page, and the app's identifiers from .env", () => {
    vi.stubEnv('VITE_APP_URL_SCHEME', 'gamblinglive')
    vi.stubEnv('VITE_ANDROID_APP_PACKAGE_NAME', 'com.gamblinglive.app')

    expect(readPlayerConfig(sharePage(), { search: '?stream=live-9' })).toEqual({
      streamId: 'live-9',
      appScheme: 'gamblinglive',
      androidPackage: 'com.gamblinglive.app',
      androidInstallUrl: 'https://play.google.com/store/apps/details?id=com.gamblinglive.app',
      iosInstallUrl: null,
    })
  })

  it('plays nothing on the development page while .env lacks those identifiers', () => {
    vi.stubEnv('VITE_APP_URL_SCHEME', '')
    vi.stubEnv('VITE_ANDROID_APP_PACKAGE_NAME', '')

    expect(readPlayerConfig(sharePage(), { search: '?stream=live-9' })).toBeNull()
  })
})
