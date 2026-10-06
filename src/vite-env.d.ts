/// <reference types="vite/client" />

// The development page's settings (.env). Production builds never read them.
interface ImportMetaEnv {
  readonly VITE_APP_URL_SCHEME?: string
  readonly VITE_ANDROID_APP_PACKAGE_NAME?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
