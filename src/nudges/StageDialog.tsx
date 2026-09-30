import { Modal } from '../components/Modal'
import { PhoneQr } from './PhoneQr'

/** On a computer: going on stage takes the app, so hand the live over to their phone. */
export function StageDialog({ hostName, url, onClose }: { hostName: string; url: string; onClose(): void }) {
  return (
    <Modal labelledBy="stage-title" onClose={onClose}>
      <h2 id="stage-title">Join the stage from your phone</h2>
      <p className="modal-body">
        Going on stage with {hostName} takes the Mela app. Scan this to open the live on your phone.
      </p>
      <PhoneQr url={url} label="QR code for this live" />
      <div className="modal-actions">
        <button type="button" className="btn btn-quiet btn-block" onClick={onClose}>
          Keep watching here
        </button>
      </div>
    </Modal>
  )
}
