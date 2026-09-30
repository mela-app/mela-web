import { useEffect, useState } from 'react'
import { qrPath } from '../lib/qr'

interface Drawn {
  size: number
  path: string
}

/** A QR code for [url], drawn as SVG (the encoder loads only when one's shown). */
export function PhoneQr({ url, label }: { url: string; label: string }) {
  const [drawn, setDrawn] = useState<Drawn | null>(null)

  useEffect(() => {
    let cancelled = false
    void import('uqr').then(({ encode }) => {
      if (cancelled) return
      const { size, data } = encode(url, { ecc: 'M', border: 2 })
      setDrawn({ size, path: qrPath(data) })
    })
    return () => {
      cancelled = true
    }
  }, [url])

  if (!drawn) return <div className="qr qr-loading" aria-hidden="true" />
  return (
    <svg className="qr" viewBox={`0 0 ${drawn.size} ${drawn.size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={drawn.size} height={drawn.size} fill="#fff" />
      <path d={drawn.path} fill="#0E0E14" />
    </svg>
  )
}
