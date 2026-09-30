import { MelaMark } from '../components/MelaLogo'

/** Always on phones: the way into the app, one tap from anywhere on the page. */
export function GetAppBar({ onOpen }: { onOpen(): void }) {
  return (
    <div className="get-app-bar">
      <MelaMark className="get-app-mark" />
      <div className="get-app-text">
        <strong>Mela</strong>
        <span>Chat, like and go live in the app</span>
      </div>
      <button type="button" className="btn btn-small btn-primary" onClick={onOpen}>
        Get the app
      </button>
    </div>
  )
}
