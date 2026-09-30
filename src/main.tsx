import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { readPlayerConfig } from './config'
import { detectDevice } from './lib/device'
import { WebSession } from './lib/session'
import './styles.css'

// Without a live to play, the share page's own content stays as it is.
const root = document.getElementById('mela-player')
const config = readPlayerConfig(document, window.location)
if (root && config) {
  const session = new WebSession()
  void session.restore()
  createRoot(root).render(
    <StrictMode>
      <App config={config} session={session} device={detectDevice(navigator)} />
    </StrictMode>,
  )
}
