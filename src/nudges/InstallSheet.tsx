import { MelaLogo } from '../components/MelaLogo'
import { Modal } from '../components/Modal'
import { installCopy, type Gate } from '../copy'

interface InstallSheetProps {
  gate: Gate
  hostName: string
  /** Null when there's no store listing for this phone yet. */
  installUrl: string | null
  onOpenApp(): void
  onClose(): void
}

/** On phones: what they tapped happens in the app - open it, or get it. */
export function InstallSheet({ gate, hostName, installUrl, onOpenApp, onClose }: InstallSheetProps) {
  const { title, body } = installCopy(gate, hostName)
  return (
    <Modal labelledBy="install-title" variant="sheet" onClose={onClose}>
      <MelaLogo className="sheet-logo" />
      <h2 id="install-title">{title}</h2>
      <p className="modal-body">{body}</p>
      <div className="modal-actions">
        <button type="button" className="btn btn-primary btn-block" data-autofocus onClick={onOpenApp}>
          Open in the app
        </button>
        {installUrl && (
          <a className="btn btn-quiet btn-block" href={installUrl} rel="noopener">
            Get the app
          </a>
        )}
        <button type="button" className="btn btn-text btn-block" onClick={onClose}>
          Not now
        </button>
      </div>
    </Modal>
  )
}
