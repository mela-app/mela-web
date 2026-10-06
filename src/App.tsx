import { useCallback, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { AuthDialog } from './auth/AuthDialog'
import { firebaseGoogleSignIn } from './auth/googleSignIn'
import { Avatar } from './components/Avatar'
import { CloseIcon, HeartIcon, MessageIcon, ShareIcon, StageIcon } from './components/Icons'
import { MelaLogo } from './components/MelaLogo'
import { Modal } from './components/Modal'
import type { PlayerConfig } from './config'
import { installUrl, liveUrl, openApp } from './lib/appLinks'
import type { Device } from './lib/device'
import { compactCount } from './lib/format'
import { useMediaQuery, useTimedNudge } from './lib/hooks'
import type { WebSession, WebUser } from './lib/session'
import { ChatList } from './live/ChatList'
import { Composer } from './live/Composer'
import { EndedView } from './live/EndedView'
import { Hearts } from './live/Hearts'
import { HostBar } from './live/HostBar'
import { Stage } from './live/Stage'
import { useHearts } from './live/useHearts'
import { useLive } from './live/useLive'
import { Inbox } from './messages/Inbox'
import { useUnreadMessages } from './messages/useUnreadMessages'
import { authCopy, type Gate } from './copy'
import { GetAppBar } from './nudges/GetAppBar'
import { InstallSheet } from './nudges/InstallSheet'
import { PhoneQr } from './nudges/PhoneQr'
import { StageDialog } from './nudges/StageDialog'

// A minute of watching without an account earns one prompt (once per tab).
export const NUDGE_AFTER_MS = 60_000
export const NUDGE_KEY = 'mela.web.nudged'
const WIDE = '(min-width: 900px)'
const TOAST_MS = 2500

interface AppProps {
  config: PlayerConfig
  session: WebSession
  device: Device
}

/**
 * The share page's player. On phones, joining in (chat, likes, follows, the
 * stage) is the app's: those ask them to get it. On computers they can sign
 * in and join in right here - all but the stage, which takes a phone.
 */
export function App({ config, session, device }: AppProps) {
  const user = useSyncExternalStore(session.subscribe, session.getUser)
  const live = useLive(config.streamId, session, user !== null)
  const wide = useMediaQuery(WIDE)
  const [gate, setGate] = useState<Gate | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [hearts, popHeart] = useHearts()
  const { state } = live
  const host = state.watch?.stream.host ?? null
  const hostName = host?.displayName ?? 'the host'
  const onPhone = device.mobile
  const pageUrl = liveUrl(config, window.location.origin)
  const storeUrl = installUrl(config, device.platform)
  // Direct messages on computers; phones have them in the app.
  const messaging = user !== null && !onPhone
  const unread = useUnreadMessages(session, messaging, live.inbox)
  const [inboxOpen, setInboxOpen] = useState(false)
  // Signing up on the web is Google's; without Firebase's settings, it's the app's.
  const google = useMemo(() => (config.firebase ? firebaseGoogleSignIn(config.firebase) : null), [config.firebase])

  const [nudged, dismissNudge] = useTimedNudge(state.phase === 'live' && user === null, NUDGE_AFTER_MS, NUDGE_KEY)
  const asking: Gate | null = gate ?? (nudged && user === null ? 'timed' : null)
  const close = useCallback(() => {
    setGate(null)
    dismissNudge()
  }, [dismissNudge])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  // Browsers hold sound back until a tap: the first one anywhere lets it play.
  const { audioBlocked, unlockAudio } = live
  useEffect(() => {
    if (!audioBlocked) return
    const unlock = () => unlockAudio()
    document.addEventListener('click', unlock, { once: true, capture: true })
    return () => document.removeEventListener('click', unlock, { capture: true })
  }, [audioBlocked, unlockAudio])

  const openInApp = () => openApp(config, device.platform)

  const like = () => {
    if (!user) return setGate('like')
    popHeart()
    live.sendLike()
  }

  const follow = (following: boolean) =>
    live.setFollowing(following).catch(() => {
      setToast(following ? "Couldn't follow. Try again." : "Couldn't unfollow. Try again.")
    })

  const toggleFollow = () => {
    if (!user) return setGate('follow')
    void follow(!state.isFollowingHost)
  }

  const share = async () => {
    if (onPhone && 'share' in navigator) {
      await navigator.share({ title: `${hostName} is live on Mela`, url: pageUrl }).catch(() => undefined)
      return
    }
    try {
      await navigator.clipboard.writeText(pageUrl)
      setToast('Link copied')
    } catch {
      setToast(pageUrl)
    }
  }

  // Signed in from a prompt: carry on with what they tapped.
  const signedIn = () => {
    const wanted = gate
    close()
    if (wanted === 'follow' && session.getUser()?.id !== host?.id) void follow(true)
  }

  let dialog: ReactNode = null
  if (asking && onPhone) {
    dialog = (
      <InstallSheet gate={asking} hostName={hostName} installUrl={storeUrl} onOpenApp={openInApp} onClose={close} />
    )
  } else if (asking === 'stage') {
    dialog = <StageDialog hostName={hostName} url={pageUrl} onClose={close} />
  } else if (asking && !user) {
    const { title, body } = authCopy(asking, hostName)
    dialog = (
      <AuthDialog session={session} google={google} title={title} body={body} onSignedIn={signedIn} onClose={close} />
    )
  }

  const signIn = !onPhone && !user && (
    <button type="button" className="btn btn-small btn-primary" onClick={() => setGate('login')}>
      Log in
    </button>
  )
  const logOut = () => void session.logout()
  const inboxButton = messaging && <InboxButton unread={unread} onClick={() => setInboxOpen(true)} />

  let main: ReactNode
  if (state.phase === 'ended' || state.phase === 'banned') {
    main = (
      <EndedView
        reason={state.endedReason}
        message={state.endedMessage}
        removed={state.phase === 'banned'}
        hostName={host?.displayName ?? null}
        onPhone={onPhone}
        installUrl={storeUrl}
        pageUrl={pageUrl}
        onOpenApp={openInApp}
      />
    )
  } else if (state.phase === 'error') {
    main = (
      <section className="ended" aria-labelledby="error-title">
        <MelaLogo className="ended-logo" />
        <h1 id="error-title">Couldn't load this live</h1>
        <p>{state.error ?? 'Something went wrong.'}</p>
        <button type="button" className="btn btn-primary" onClick={live.retry}>
          Try again
        </button>
      </section>
    )
  } else {
    const stage = (
      <Stage
        tiles={live.tiles}
        fit={wide ? 'contain' : 'cover'}
        host={host}
        guests={state.guests}
        moving={state.moving}
        connecting={state.phase === 'loading' || !live.connected}
        paused={state.paused}
        hostAway={state.hostAway}
        audioBlocked={live.audioBlocked}
        videoLost={live.videoLost}
        onUnlockAudio={live.unlockAudio}
        onReconnect={live.retry}
      />
    )
    const hostBar = host && (
      <HostBar
        host={host}
        viewerCount={state.viewerCount}
        following={state.isFollowingHost}
        isSelf={user?.id === host.id}
        onFollow={toggleFollow}
      />
    )
    const alert = state.alert && (
      <div className={`alert alert-${state.alert.severity.toLowerCase()}`} role="alert">
        <span>{state.alert.message}</span>
        <button type="button" className="icon-btn icon-btn-small" aria-label="Dismiss" onClick={live.dismissAlert}>
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    )
    const chat = (
      <ChatList
        messages={state.messages}
        pinned={state.pinned}
        hostId={host?.id ?? ''}
        moderatorIds={state.moderatorIds}
        variant={wide ? 'panel' : 'overlay'}
      />
    )
    const controls = (
      <div className="controls">
        <Composer canChat={user !== null} mute={state.chatMute} onSend={live.sendChat} onLocked={() => setGate('chat')} />
        <IconButton label="Join the stage" onClick={() => setGate('stage')}>
          <StageIcon />
        </IconButton>
        <IconButton label="Share" onClick={() => void share()}>
          <ShareIcon />
        </IconButton>
        <IconButton label="Like" className="icon-btn-like" onClick={like}>
          <HeartIcon />
        </IconButton>
      </div>
    )

    main = wide ? (
      <main className="wide">
        <section className="wide-stage" aria-label="Live video">
          {stage}
          <div className="stage-top">{hostBar}</div>
          <Hearts hearts={hearts} />
        </section>
        <aside className="side" aria-label="Live chat">
          <header className="side-header">
            <MelaLogo className="side-logo" />
            {user ? (
              <div className="header-end">
                {inboxButton}
                <Account user={user} onLogout={logOut} />
              </div>
            ) : (
              signIn
            )}
          </header>
          {alert}
          {chat}
          {controls}
          {!onPhone && (
            <div className="qr-card">
              <PhoneQr url={pageUrl} label="QR code to watch on your phone" />
              <div>
                <strong>Watch on your phone</strong>
                <span>Scan to open this live in the Mela app.</span>
              </div>
            </div>
          )}
        </aside>
      </main>
    ) : (
      <main className="narrow">
        {stage}
        <div className="stage-top">
          {hostBar}
          {user ? (
            <div className="header-end stage-top-end">
              {inboxButton}
              <button type="button" className="btn btn-small btn-quiet" onClick={logOut}>
                Log out
              </button>
            </div>
          ) : (
            signIn
          )}
        </div>
        <div className="narrow-bottom">
          {alert}
          {chat}
          {controls}
        </div>
        <Hearts hearts={hearts} />
      </main>
    )
  }

  return (
    <div className={onPhone ? 'player on-phone' : 'player'}>
      {onPhone && <GetAppBar onOpen={openInApp} />}
      {main}
      {dialog}
      {inboxOpen && user && !onPhone && (
        <Modal labelledBy="inbox-title" variant="drawer" onClose={() => setInboxOpen(false)}>
          <Inbox session={session} self={user} events={live.inbox} />
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function IconButton(props: { label: string; className?: string; onClick(): void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={props.className ? `icon-btn ${props.className}` : 'icon-btn'}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

function InboxButton({ unread, onClick }: { unread: number; onClick(): void }) {
  return (
    <button
      type="button"
      className="icon-btn inbox-btn"
      aria-label={unread > 0 ? `Inbox, ${unread} unread` : 'Inbox'}
      title="Inbox"
      onClick={onClick}
    >
      <MessageIcon />
      {unread > 0 && (
        <span className="inbox-count" aria-hidden="true">
          {compactCount(unread)}
        </span>
      )}
    </button>
  )
}

function Account({ user, onLogout }: { user: WebUser; onLogout(): void }) {
  return (
    <div className="account">
      <Avatar person={user} size="sm" />
      <span className="account-name">{user.displayName}</span>
      <button type="button" className="btn btn-small btn-text" onClick={onLogout}>
        Log out
      </button>
    </div>
  )
}
