import { store } from '../store'
import type { Snapshot } from '../store'
import { simClock } from '../hooks'
import { startDemo, stopDemo } from '../demo'

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" className="logo">
      <path d="M32 6c-9 10-14 17-14 25a14 14 0 0 0 28 0c0-8-5-15-14-25z" fill="#ffb347" />
      <circle cx="32" cy="34" r="6" fill="#fff4d6" />
    </svg>
  )
}

export function Header({ s, onJoin }: { s: Snapshot; onJoin: () => void }) {
  const finished = s.tick >= s.total
  return (
    <header className="top">
      <div className="brand">
        <Logo />
        <div>
          <h1>Lantern</h1>
          <p>The Hollow's shared truth</p>
        </div>
      </div>

      <div className="clock" aria-live="off">
        <strong>{simClock(s.tick)}</strong>
        <span>
          tick {s.tick}/{s.total}
        </span>
      </div>

      <div className="controls">
        {s.playing ? (
          <button onClick={store.pause}>Pause</button>
        ) : (
          <button onClick={store.play} disabled={!s.ready || finished}>
            {s.tick === 0 ? 'Start' : 'Resume'}
          </button>
        )}
        <label className="speed">
          Speed
          <select value={s.speed} onChange={(e) => store.setSpeed(Number(e.target.value))} aria-label="Simulation speed" disabled={s.demo.active}>
            {[1, 2, 4, 8].map((v) => (
              <option key={v} value={v}>
                {v}x
              </option>
            ))}
            {![1, 2, 4, 8].includes(s.speed) && <option value={s.speed}>{s.speed.toFixed(1)}x</option>}
          </select>
        </label>
        <button onClick={() => void store.reset()} disabled={!s.ready}>
          Reset
        </button>
      </div>

      <div className="switches">
        <button className={s.uplink ? 'sw on' : 'sw off'} aria-pressed={!s.uplink} onClick={() => store.setUplink(!s.uplink)} title="Simulate the Directorate shutting down the network">
          {s.uplink ? '● Directorate network: online' : '✖ Directorate network: CUT'}
        </button>
        <button className={s.trustOn ? 'sw on' : 'sw off'} aria-pressed={s.trustOn} onClick={() => store.setTrust(!s.trustOn)} title="Require independent corroboration before the map changes">
          {s.trustOn ? '● Trust rule: on' : '✖ Trust rule: OFF'}
        </button>
      </div>

      <div className="right-actions">
        <button onClick={onJoin} title="Show a QR code phones can scan to join the mesh">
          📱 Join {s.mesh.phones > 0 && <span className="count good-bg">{s.mesh.phones}</span>}
        </button>
        <a className="btn" href="#/pitch">
          Slides
        </a>
        <button className="demo" onClick={() => (s.demo.active ? stopDemo() : void startDemo())} disabled={!s.ready}>
          {s.demo.active ? 'Stop demo' : '▶ Run demo'}
        </button>
      </div>
    </header>
  )
}
