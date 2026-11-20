import { useEffect, useState } from 'react'
import type { Snapshot } from '../store'
import { Logo } from './Header'
import { PROBLEMS } from '../modules/registry'
import { JoinCard } from './Join'

/** The engines and the problems each one answers: one spine, three engines, fifteen problems. */
export function ConnectDiagram() {
  const groups = [
    { id: 'sense', label: 'SENSE', sub: 'know what is really happening', probs: [1, 3, 4, 5, 9, 11, 13], x: 120 },
    { id: 'share', label: 'SHARE', sub: 'split what is scarce, fairly', probs: [2, 6, 10, 12, 14, 15], x: 400 },
    { id: 'reach', label: 'REACH', sub: 'find people and safe paths', probs: [7, 8, 5, 10], x: 680 },
  ]
  return (
    <svg className="connect" viewBox="0 0 800 330" role="img" aria-label="Lantern's truth layer feeds three engines that answer all 15 problems">
      <rect x="150" y="10" width="500" height="64" rx="12" className="spine" />
      <text x="400" y="38" className="t1">
        Verifiable truth layer
      </text>
      <text x="400" y="60" className="t2">
        signed · corroborated · gossiped device to device · no off switch
      </text>
      {groups.map((g) => (
        <g key={g.id}>
          <line x1="400" y1="74" x2={g.x} y2="120" className="wire" />
          <rect x={g.x - 115} y="120" width="230" height="58" rx="10" className={`eng ${g.id}`} />
          <text x={g.x} y="146" className="t1">
            {g.label}
          </text>
          <text x={g.x} y="166" className="t2">
            {g.sub}
          </text>
          {g.probs.map((p, i) => (
            <g key={p}>
              <line x1={g.x} y1="178" x2={g.x - 105 + (i % 4) * 70 + 20} y2={210 + Math.floor(i / 4) * 54} className="wire thin" />
              <circle cx={g.x - 105 + (i % 4) * 70 + 20} cy={226 + Math.floor(i / 4) * 54} r="17" className={`pn ${g.id}`} />
              <text x={g.x - 105 + (i % 4) * 70 + 20} y={231 + Math.floor(i / 4) * 54} className="t3">
                {p}
              </text>
            </g>
          ))}
        </g>
      ))}
    </svg>
  )
}

export function Pitch({ s }: { s: Snapshot }) {
  const [i, setI] = useState(0)
  const slides = [
    {
      title: 'Level 9. 3 a.m. The lights go out.',
      body: (
        <>
          <p className="lead">A mother, two kids, one room. The network goes with the lights. Her sister is four levels up.</p>
          <p className="lead">The Directorate's bulletin says: <em>"All systems normal."</em></p>
        </>
      ),
    },
    {
      title: 'One set of hands holds the air, the grid, the network, and the numbers.',
      body: (
        <ul className="big-list">
          <li>Official: ~35 lung-sickness cases. Residents see hundreds.</li>
          <li>Deep levels lose power first, and get shares last.</li>
          <li>The network can be switched off at will.</li>
          <li>Nobody can prove whether the surface is safe.</li>
        </ul>
      ),
    },
    {
      title: 'Lantern: a truth layer nobody can switch off or fake.',
      body: (
        <>
          <p className="lead">Every observation is signed, cross-checked against independent evidence, and passed device to device. From that shared truth, three engines answer all 15 problems.</p>
          <ConnectDiagram />
        </>
      ),
    },
    {
      title: 'Join the mesh now.',
      body: (
        <>
          <p className="lead">Your phone makes its own key. Check in, call for help, and watch it land on the big screen. Then we cut the network.</p>
          <JoinCard s={s} big />
        </>
      ),
    },
    {
      title: 'What is real',
      body: (
        <table className="realtable">
          <tbody>
            <tr>
              <th>Real code, tested</th>
              <td>ECDSA signing (WebCrypto + noble), gossip with anti-entropy, a relay, Sybil-resistant reputation, hash-chained probe log, wet-bulb heat model, Dijkstra routing, max-min fairness, Edmonds-Karp max-flow, k-anonymity, PBKDF2 phrases</td>
            </tr>
            <tr>
              <th>Simulated</th>
              <td>Sensors, 300 devices, surface probes, the radio. Production radio: BLE / LoRa / Wi-Fi Direct. Nothing above the transport changes.</td>
            </tr>
            <tr>
              <th>Not claimed</th>
              <td>That the surface is safe. Lantern shows evidence and how sure it is.</td>
            </tr>
          </tbody>
        </table>
      ),
    },
    {
      title: 'Survive today. Prove the way home. Go back fairly.',
      body: (
        <>
          <div className="all15">
            {Object.entries(PROBLEMS).map(([n, t]) => (
              <span key={n} className="chip lit" title={t}>
                {n}
              </span>
            ))}
          </div>
          <p className="lead">The same fairness rule that shares power tonight decides who goes up first tomorrow, so the deep levels are never last again.</p>
          <p className="lead">Next: calibrate with real clinics and sensors, and take it to the lowest levels first.</p>
        </>
      ),
    },
  ]

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') setI((x) => Math.min(slides.length - 1, x + 1))
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setI((x) => Math.max(0, x - 1))
      if (e.key === 'Escape') location.hash = ''
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [slides.length])

  const sl = slides[i]
  return (
    <div className="deck">
      <div className="slide">
        <div className="slide-brand">
          <Logo size={28} /> Lantern <span className="muted small">Patriot HackFest 2026 · Life Underground</span>
        </div>
        <h1>{sl.title}</h1>
        <div className="slide-body">{sl.body}</div>
      </div>
      <nav className="deck-nav">
        <button onClick={() => setI(Math.max(0, i - 1))} disabled={i === 0}>
          ←
        </button>
        <span>
          {i + 1} / {slides.length}
        </span>
        <button onClick={() => setI(Math.min(slides.length - 1, i + 1))} disabled={i === slides.length - 1}>
          →
        </button>
        <a className="btn" href="#">
          Back to the app
        </a>
      </nav>
    </div>
  )
}
