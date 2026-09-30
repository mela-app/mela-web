import { MelaLogo } from '../components/MelaLogo'
import { endedCopy } from '../copy'
import { PhoneQr } from '../nudges/PhoneQr'

interface EndedViewProps {
  reason: string | null
  /** The administrator's own words, when they stopped it. */
  message: string | null
  removed: boolean
  hostName: string | null
  onPhone: boolean
  installUrl: string | null
  pageUrl: string
  onOpenApp(): void
}

/** The live's over (or they were shown out): point them at the app for the next one. */
export function EndedView(props: EndedViewProps) {
  const { title, body } = endedCopy(props.reason, props.removed, props.hostName)
  return (
    <section className="ended" aria-labelledby="ended-title">
      <MelaLogo className="ended-logo" />
      <h1 id="ended-title">{title}</h1>
      <p>{body}</p>
      {props.message && <blockquote className="ended-reason">{props.message}</blockquote>}
      {props.onPhone ? (
        <div className="ended-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={props.onOpenApp}>
            Open the app
          </button>
          {props.installUrl && (
            <a className="btn btn-quiet btn-block" href={props.installUrl} rel="noopener">
              Get the app
            </a>
          )}
        </div>
      ) : (
        <div className="qr-card">
          <PhoneQr url={props.pageUrl} label="QR code to get Mela on your phone" />
          <div>
            <strong>Get Mela on your phone</strong>
            <span>Scan to get the app and catch the next live.</span>
          </div>
        </div>
      )}
    </section>
  )
}
