/** Why the page is asking them to sign in or get the app. */
export type Gate = 'chat' | 'like' | 'follow' | 'stage' | 'timed' | 'login'

/** The install prompt on phones: joining in happens in the app. */
export function installCopy(gate: Gate, host: string): { title: string; body: string } {
  const body = `Chat, send likes, follow ${host} and join the stage in the Mela app.`
  switch (gate) {
    case 'chat':
      return { title: `Chat with ${host} in the app`, body }
    case 'like':
      return { title: 'Send likes from the app', body }
    case 'follow':
      return { title: `Follow ${host} in the app`, body }
    case 'stage':
      return { title: 'Join the stage from the app', body: `Going on stage with ${host} takes the Mela app.` }
    case 'timed':
    case 'login':
      return { title: 'Enjoying the live?', body: `Get the Mela app to join in - and never miss when ${host} goes live.` }
  }
}

/** The sign-in prompt on computers: joining in (all but the stage) works right here. */
export function authCopy(gate: Gate, host: string): { title: string; body: string } {
  const body = 'Watching is free. Log in or create an account to join in.'
  switch (gate) {
    case 'chat':
      return { title: `Log in to chat with ${host}`, body }
    case 'like':
      return { title: 'Log in to send likes', body }
    case 'follow':
      return { title: `Log in to follow ${host}`, body }
    case 'timed':
      return { title: `Enjoying ${host}'s live?`, body: 'Log in or sign up to chat, send likes and follow.' }
    case 'stage':
    case 'login':
      return { title: 'Log in to Mela', body }
  }
}

/** The app's words for how a live ended (mobile: live_ended_view.dart). */
export function endedCopy(reason: string | null, removed: boolean, hostName: string | null): { title: string; body: string } {
  const who = hostName || 'The host'
  if (removed) return { title: 'Removed from stream', body: `${who} removed you from this stream.` }
  switch (reason) {
    case 'HOST_ENDED':
      return { title: 'LIVE has ended', body: `${who} ended the live. Thanks for watching!` }
    case 'HOST_DISCONNECTED':
      return { title: 'LIVE has ended', body: `${who} lost connection, so the live couldn't continue.` }
    case 'REPLACED':
      return { title: 'LIVE has ended', body: `${who} started a new live.` }
    case 'LOCKED':
      return { title: 'This live was stopped', body: 'An administrator stopped this live.' }
    default:
      return { title: 'LIVE has ended', body: 'This live is over. Thanks for watching!' }
  }
}
