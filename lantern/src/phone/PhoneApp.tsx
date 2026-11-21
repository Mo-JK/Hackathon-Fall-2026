import { useEffect, useState, useSyncExternalStore } from 'react'
import { phone } from './phoneStore'
import { Logo } from '../components/Header'
import { LEVELS, BLOCKS_PER_LEVEL, blockId } from '../sim/world'
import type { SosNeed } from '../types'
import { phraseStrength } from '../mesh/crypto'

const BLOCKS = Array.from({ length: LEVELS * BLOCKS_PER_LEVEL }, (_, i) => blockId(Math.floor(i / BLOCKS_PER_LEVEL) + 1, i % BLOCKS_PER_LEVEL))

export function PhoneApp() {
  const s = useSyncExternalStore(phone.subscribe, phone.getSnapshot)
  const [phrase, setPhrase] = useState('')
  const [need, setNeed] = useState<SosNeed>('medical')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void phone.start()
  }, [])
  const run = (p: Promise<unknown>) => {
    setBusy(true)
    void p.finally(() => setBusy(false))
  }
  const strength = phraseStrength(phrase)

  return (
    <div className="phone">
      <header className="phone-top">
        <Logo size={26} />
        <div>
          <h1>Lantern</h1>
          <p className="small muted">You're a device in the mesh</p>
        </div>
        <span className={`pill ${s.relayUp ? 'up' : 'down'}`}>{s.relayUp ? 'relay ✓' : s.peers ? 'tab link' : 'offline'}</span>
      </header>

      {s.error && <p className="status off">Could not start: {s.error}</p>}

      <section className="phone-card">
        <div className="me">
          <span className="muted small">Your device code (show it to be vouched for)</span>
          <strong className="mono code">{s.me ? s.me.slice(0, 6).toUpperCase() : '……'}</strong>
          <span className={`small ${s.vouchedBy ? 'good' : 'muted'}`}>{s.vouchedBy ? `Vouched for by ${s.vouchedBy.slice(0, 6)}: your reports now count fully` : 'Newcomer: your reports count a little until someone vouches for you'}</span>
        </div>
        <label className="field">
          Where are you?
          <select value={s.block} onChange={(e) => phone.setBlock(e.target.value)}>
            {BLOCKS.map((b) => (
              <option key={b} value={b}>
                Level {b.slice(1, b.indexOf('-'))}, Block {b.slice(-1)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="phone-card">
        <h2>I'm OK</h2>
        <input
          value={phrase}
          onChange={(e) => {
            setPhrase(e.target.value)
            void phone.setPhrase(e.target.value)
          }}
          placeholder="family phrase, e.g. blue-heron-7"
          autoComplete="off"
          aria-label="Family phrase"
        />
        {phrase.trim() && <span className={`strength ${strength.label} small`}>strength: {strength.label}</span>}
        <button className="primary big-btn" disabled={!s.ready || !phrase.trim() || busy} onClick={() => run(phone.checkIn(phrase))}>
          I'm OK
        </button>
        {s.family.length > 0 && (
          <p className="good small">
            Family found: OK in {s.family.map((f) => f.blockId).join(', ')}
          </p>
        )}
      </section>

      <section className="phone-card">
        <h2>Call for help</h2>
        <div className="seg">
          {(['medical', 'trapped', 'water', 'heat'] as SosNeed[]).map((n) => (
            <button key={n} className={need === n ? 'active-btn' : ''} onClick={() => setNeed(n)}>
              {n}
            </button>
          ))}
        </div>
        <button className="danger-btn big-btn" disabled={!s.ready || busy} onClick={() => run(phone.sos(need))}>
          Send SOS
        </button>
        {s.myResponders !== null && (
          <p className={`small ${s.myResponders ? 'good' : 'muted'}`} role="status">
            {s.myResponders ? `Your SOS was heard: ${s.myResponders} ${s.myResponders === 1 ? 'person is' : 'people are'} on the way.` : 'Your SOS is out. Waiting for someone nearby to answer.'}
          </p>
        )}
      </section>

      {s.calls.length > 0 && (
        <section className="phone-card">
          <h2>People nearby need help</h2>
          <ul className="plain small">
            {s.calls.map((c) => (
              <li key={c.blockId} className="sos-row">
                <span className="sos-dot" /> <strong>{c.blockId}</strong>: {c.need}
                <span className={c.responders ? 'who' : 'who none'}>· {c.responders ? `${c.responders} on the way` : 'nobody yet'}</span>
                {c.mineAnswering ? (
                  <span className="tag mask">you're going</span>
                ) : (
                  <button className="small-btn" disabled={!s.ready || busy} onClick={() => run(phone.respond(c.blockId))}>
                    I can help
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="phone-card">
        <h2>Report</h2>
        <div className="seg">
          <button disabled={!s.ready || busy} onClick={() => run(phone.report('outage', 'Power flickering'))}>
            Power flickering
          </button>
          <button disabled={!s.ready || busy} onClick={() => run(phone.report('water_taste', 'Water tastes wrong'))}>
            Water tastes wrong
          </button>
          <button disabled={!s.ready || busy} onClick={() => run(phone.report('symptom', 'I have a cough'))}>
            I have a cough
          </button>
        </div>
      </section>

      <section className="phone-card">
        <h2>Sent from this phone</h2>
        {!s.sent.length ? (
          <p className="muted small">Nothing yet. Everything you send is signed with your phone's own key.</p>
        ) : (
          <ul className="plain small">
            {s.sent.map((x) => (
              <li key={x.id}>
                {x.text} <span className="muted">· {s.relayUp || s.peers ? 'delivered to the mesh' : 'queued, sends when a peer appears'}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          Signing: {s.crypto === 'webcrypto' ? 'WebCrypto' : 'noble (pure JS, works over plain http)'} · {s.peers} peer{s.peers === 1 ? '' : 's'} · {s.sosNearby} SOS in mesh
        </p>
      </section>
    </div>
  )
}
