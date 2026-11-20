import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { Snapshot } from '../store'

/** The address phones should open: the relay's LAN address if it is running, else this page. */
export function joinUrl(s: Snapshot): string {
  const base = s.relayUrls[0] ?? `${location.origin}${location.pathname}`
  return `${base.replace(/\/$/, '')}/?phone`
}

export function QR({ text, size = 168 }: { text: string; size?: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let live = true
    void QRCode.toString(text, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#1b1305', light: '#ffe9c2' } }).then((x) => live && setSvg(x))
    return () => {
      live = false
    }
  }, [text])
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label={`QR code for ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />
}

export function JoinCard({ s, big = false }: { s: Snapshot; big?: boolean }) {
  const url = joinUrl(s)
  const relayUp = s.mesh.links.some((l) => l.name === 'relay' && l.up)
  return (
    <div className={`join${big ? ' big' : ''}`}>
      <QR text={url} size={big ? 260 : 132} />
      <div>
        <strong>Join the mesh from your phone</strong>
        <p className="mono small">{url}</p>
        {relayUp && s.relayUrls.length ? (
          <p className="muted small">Same Wi-Fi or hotspot as this laptop. No app, no account: your phone makes its own key.</p>
        ) : (
          <p className="muted small">Relay not running, so phones can't reach this laptop yet. Run <code>npm run demo</code> (see DEMO-CHECKLIST.md). Meanwhile, open the address above in another tab to try phone mode here.</p>
        )}
        {s.mesh.phones > 0 && (
          <p className="good small">
            {s.mesh.phones} phone{s.mesh.phones === 1 ? '' : 's'} connected
          </p>
        )}
      </div>
    </div>
  )
}

export function JoinModal({ s, onClose }: { s: Snapshot; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Join the mesh" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <JoinCard s={s} big />
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
