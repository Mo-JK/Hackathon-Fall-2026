import { useEffect, useMemo, useState } from 'react'
import { store, normalisePhrase } from '../store'
import type { Snapshot } from '../store'
import { KIND_INFO } from '../sim/world'
import { computeAllocation, RESOURCE_LABEL } from '../engine/allocation'
import { distribute } from '../engine/outbreak'
import { NEWCOMER_CAP, VOUCH_BUDGET } from '../engine/reputation'
import { phraseHash, phraseStrength } from '../mesh/crypto'
import type { Checkin, Resource } from '../types'
import { num, pct } from '../hooks'
import { JoinCard } from './Join'

// ---------- alerts ----------
export function AlertsPanel({ s }: { s: Snapshot }) {
  const list = s.alerts.slice(0, 14)
  if (!list.length) return <p className="muted pad">No warnings. Press Start and watch what Lantern sees coming.</p>
  return (
    <ul className="alerts">
      {list.map((a) => {
        const info = KIND_INFO[a.kind]
        return (
          <li key={a.id} className={a.level}>
            <details open={s.selected === a.blockId}>
              <summary onClick={() => store.select(a.blockId)}>
                <span className="badge">{a.level === 'critical' ? '✖ NOW' : `▲ in ~${a.etaMinutes} min`}</span>
                {a.level === 'critical' && (s.leads.get(`${a.blockId}:${a.kind}`) ?? 0) > 0 && (
                  <span className="lead" title="How long before the line was crossed Lantern first warned">warned {s.leads.get(`${a.blockId}:${a.kind}`)} min ahead</span>
                )}
                <strong>
                  {a.blockId} · {info.label}
                </strong>
                <span className="conf" title="Confidence">
                  <i style={{ width: pct(a.confidence) }} />
                </span>
              </summary>
              <p className="muted small">Why: {a.reasons.join(' ')}</p>
            </details>
          </li>
        )
      })}
      {s.alerts.length > list.length && <li className="muted small">+{s.alerts.length - list.length} more</li>}
    </ul>
  )
}

// ---------- outbreak ----------
const STOCK = { masks: 20000, inhalers: 3000 }

export function OutbreakPanel({ s }: { s: Snapshot }) {
  const flagged = [...s.outbreak.blocks.values()].filter((b) => b.flagged)
  const masks = distribute(STOCK.masks, flagged.map((b) => b.estCases))
  const inhalers = distribute(STOCK.inhalers, flagged.map((b) => b.estCases))
  return (
    <div className="pad">
      <div className="compare">
        <div>
          <span className="muted small">Directorate</span>
          <strong className="big">{num(s.official.cases)}</strong>
        </div>
        <div>
          <span className="muted small">Lantern estimate</span>
          <strong className="big hot">~{num(s.outbreak.estimatedCases)}</strong>
        </div>
      </div>
      {!flagged.length ? (
        <p className="muted">No block is above its normal symptom-report rate yet.</p>
      ) : (
        <>
          <h3>Clusters</h3>
          <ul className="plain">
            {s.outbreak.clusters.map((c) => (
              <li key={c.blocks.join()}>
                <strong>{[...c.blocks].sort().join(', ')}</strong>: ~{num(c.estCases)} active cases
              </li>
            ))}
          </ul>
          <h3>Suggested supply split</h3>
          <p className="muted small">
            Stock on hand: {num(STOCK.masks)} masks, {num(STOCK.inhalers)} inhalers, split in proportion to estimated cases. The Care tab adds medicine demand from triage.
          </p>
          <table>
            <thead>
              <tr>
                <th>Block</th>
                <th>Est. cases</th>
                <th>Masks</th>
                <th>Inhalers</th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((b, i) => (
                <tr key={b.blockId} onClick={() => store.select(b.blockId)}>
                  <td>{b.blockId}</td>
                  <td>{num(b.estCases)}</td>
                  <td>{num(masks[i])}</td>
                  <td>{num(inhalers[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="muted small">
        Method: each block's symptom reports in the last hour are compared with its own quiet-period baseline. Flagged at z ≥ 3. Cases are estimated assuming 0.4% of active cases file a report per 10 minutes.
      </p>
    </div>
  )
}

// ---------- fair share ----------
export function SharePanel({ s }: { s: Snapshot }) {
  const [resource, setResource] = useState<Resource>('power')
  const [supply, setSupply] = useState(55)
  const blocks = store.blocks
  const alloc = useMemo(
    () => computeAllocation(blocks, resource, supply / 100, (id) => s.views.get(id)?.hazards ?? 0),
    [blocks, resource, supply, s.views],
  )
  return (
    <div className="pad">
      <div className="row">
        <label>
          Resource{' '}
          <select value={resource} onChange={(e) => setResource(e.target.value as Resource)}>
            {(Object.keys(RESOURCE_LABEL) as Resource[]).map((r) => (
              <option key={r} value={r}>
                {RESOURCE_LABEL[r]}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Available: <strong>{supply}%</strong> of need
          <input type="range" min={20} max={100} value={supply} onChange={(e) => setSupply(Number(e.target.value))} />
        </label>
      </div>

      <div className="compare">
        <div>
          <span className="muted small">Upper levels first (today)</span>
          <strong className="big">{pct(alloc.official.minCoverage)}</strong>
          <span className="muted small">worst-served block · {num(alloc.official.peopleBelowHalf)} people under 50%</span>
        </div>
        <div>
          <span className="muted small">Lantern fair share</span>
          <strong className="big good">{pct(alloc.fair.minCoverage)}</strong>
          <span className="muted small">worst-served block · {num(alloc.fair.peopleBelowHalf)} people under 50%</span>
        </div>
      </div>
      <p className="muted small">
        Inequality (Gini, 0 = equal): {alloc.official.gini.toFixed(2)} today vs {alloc.fair.gini.toFixed(2)} fair.
      </p>

      <h3>Coverage of need, by level</h3>
      <ul className="bars" aria-label="Coverage of need by level">
        {alloc.levels.map((r) => (
          <li key={r.level}>
            <span className="lbl">L{r.level}</span>
            <span className="pair">
              <span className="bar today" style={{ width: pct(r.officialCoverage) }}>
                <i>{pct(r.officialCoverage)}</i>
              </span>
              <span className="bar fair" style={{ width: pct(r.fairCoverage) }}>
                <i>{pct(r.fairCoverage)}</i>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        <span className="key today" /> today <span className="key fair" /> fair share. Need = people × per-person need × depth hardship × (1 + 25% per confirmed hazard in the block). The same rule splits fans (Heat), lamp hours (Light), food (Food) and lift capacity on the way up. It is an auditable proposal: neighbourhoods can use it to negotiate and to show who is being left out.
      </p>
    </div>
  )
}

// ---------- mesh ----------
const STATUS_WORD = { established: 'member', vouched: 'vouched', earned: 'earned trust', newcomer: 'newcomer' } as const

export function MeshPanel({ s }: { s: Snapshot }) {
  const m = s.mesh
  const relay = m.links.find((l) => l.name === 'relay')
  const atk = s.attack ? s.views.get(s.attack.blockId) : undefined
  const ev = atk?.truth.evidence.power
  return (
    <div className="pad">
      <p className={s.uplink ? 'status on' : 'status off'}>{s.uplink ? 'Directorate network is online. Lantern does not depend on it.' : 'Directorate network is CUT. Lantern is still syncing over the mesh.'}</p>

      <div className="links">
        <span className={relay?.up ? 'link up' : 'link down'}>
          <i /> Community relay {relay?.up ? 'connected' : 'not reachable'}
        </span>
        <span className="link up">
          <i /> Tab link
        </span>
        <span className="muted small">
          {m.peers} live peer{m.peers === 1 ? '' : 's'}, {m.phones} phone{m.phones === 1 ? '' : 's'}
        </span>
      </div>
      {m.catchUp && m.catchUp.n > 0 && (
        <p className="catchup">
          {m.catchUp.reconnect
            ? `Caught up: ${m.catchUp.n} message${m.catchUp.n === 1 ? '' : 's'} arrived when the ${m.catchUp.via} link came back.`
            : `Synced ${m.catchUp.n} message${m.catchUp.n === 1 ? '' : 's'} from the mesh on joining.`}
        </p>
      )}

      <JoinCard s={s} />

      <h3>Real devices in the mesh</h3>
      {!s.realDevices.length ? (
        <p className="muted small">None yet. Scan the code above with a phone, or open this page with ?phone in another tab.</p>
      ) : (
        <ul className="devices">
          {s.realDevices.slice(0, 8).map((d) => (
            <li key={d.deviceKey}>
              <span className="mono">{d.deviceKey.slice(0, 6)}</span>
              <span className="muted small">{d.phone ? 'phone' : 'device'}</span>
              <span className={`rep ${d.rep.status}`}>
                {STATUS_WORD[d.rep.status]} · weight {d.rep.weight.toFixed(2)}
              </span>
              {d.rep.status === 'newcomer' && (
                <button className="small-btn" onClick={() => void store.vouch(d.pub)} title="Only vouch for a device you have checked in person">
                  Vouch in person
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">
        You are a {STATUS_WORD[s.myRep.status]} (weight {s.myRep.weight.toFixed(2)}). Members can vouch for up to {VOUCH_BUDGET} devices each; vouched devices cannot vouch further.
      </p>

      <h3>Try to fake the map</h3>
      <div className="row">
        <button onClick={() => void store.sybilAttack('L2-B2', 50, 2)} disabled={!s.ready || s.tick === 0}>
          Sybil attack: 50 fake keys
        </button>
        <button onClick={() => void store.spamAttack('L2-B2', 100)} disabled={!s.ready || s.tick === 0}>
          One device, 100 reports
        </button>
        <button onClick={() => store.setTrust(!s.trustOn)}>Trust rule: {s.trustOn ? 'on' : 'OFF'}</button>
      </div>
      {s.attack && ev && (
        <div className={`attack ${atk!.status}`}>
          <strong>
            {s.attack.reports} fake "power out" reports from {s.attack.keys} key{s.attack.keys === 1 ? '' : 's'} → {s.attack.blockId} is {atk!.status === 'critical' ? 'RED' : 'still healthy'}
          </strong>
          <span className="muted small">
            {s.trustOn
              ? `Evidence ${ev.weight.toFixed(2)} of 3 needed: ${ev.newcomers} newcomer keys capped at ${NEWCOMER_CAP.toFixed(1)} together, ${ev.trustedWeight.toFixed(2)} from trusted residents, ${ev.sensor ? 'sensor confirms' : 'sensor says power is fine'}.`
              : `Trust rule off: ${ev.rawReports} raw reports count one each.`}
          </span>
        </div>
      )}

      <dl className="stats">
        <dt>Devices in mesh (simulated)</dt>
        <dd>{num(m.devices)}</dd>
        <dt>Messages accepted</dt>
        <dd>{num(m.accepted)}</dd>
        <dt>Duplicates dropped</dt>
        <dd>{num(m.duplicates)}</dd>
        <dt>Malformed or badly signed, dropped</dt>
        <dd>{num(m.invalid)}</dd>
        <dt>Fake sensor readings (unregistered key), dropped</dt>
        <dd>{num(m.spoofed)}</dd>
        <dt>Old messages from earlier sessions, not shown as live</dt>
        <dd>{num(m.stale)}</dd>
        <dt>Relayed to peers</dt>
        <dd>{num(m.relayed)}</dd>
        <dt>Reports ignored by trust rule</dt>
        <dd>{num(s.rejected)}</dd>
        <dt>Waiting for a peer</dt>
        <dd>{m.pending}</dd>
        <dt>Your device id</dt>
        <dd className="mono">{s.me || '...'}</dd>
      </dl>
      <p className="muted small">
        Real: signing, verification, dedupe, hop budgets, store-and-forward, anti-entropy sync, the relay, reputation and the trust rule. Simulated: the sensors, the 300 other devices and the radio.
      </p>
    </div>
  )
}

// ---------- family ----------
const ago = (wall: number) => {
  const sec = Math.max(0, Math.round((Date.now() - wall) / 1000))
  return sec < 60 ? `${sec}s ago` : `${Math.round(sec / 60)} min ago`
}

export function FamilyPanel({ s }: { s: Snapshot }) {
  const [found, setFound] = useState<Checkin[]>([])
  const [sent, setSent] = useState(false)
  const phrase = s.phrase
  const strength = phraseStrength(phrase)

  useEffect(() => {
    let live = true
    const p = normalisePhrase(phrase)
    if (!p) {
      setFound([])
      return
    }
    // One row per person: their newest check-in (checkins are sorted newest first).
    void phraseHash(p).then((h) => {
      if (!live) return
      const seen = new Set<string>()
      setFound(s.checkins.filter((c) => c.codeHash === h && !seen.has(c.deviceKey) && !!seen.add(c.deviceKey)))
    })
    return () => {
      live = false
    }
  }, [phrase, s.checkins])

  const other = found.find((c) => !c.mine)

  return (
    <div className="pad">
      <p className="muted small">
        Agree a secret phrase with your family ahead of time. Only a stretched hash of it is shared (PBKDF2, 100,000 rounds), together with your block, never your name.
      </p>
      <label className="field">
        Family phrase
        <input value={phrase} onChange={(e) => (setSent(false), store.setPhrase(e.target.value))} placeholder="e.g. blue-heron-7" autoComplete="off" />
      </label>
      {phrase.trim() && (
        <p className={`strength ${strength.label}`}>
          Phrase strength: {strength.label} (~{strength.bits} bits). {strength.label !== 'strong' && 'Longer, unusual phrases are much harder to guess.'}
        </p>
      )}
      <label className="field">
        Your block
        <select value={s.homeBlock} onChange={(e) => store.setHome(e.target.value)}>
          {store.blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <button className="primary" disabled={!phrase.trim() || !s.ready} onClick={() => void store.checkIn(phrase).then(() => setSent(true))}>
          I'm OK
        </button>
        {sent && <span className="muted small">Sent. {s.mesh.pending ? `${s.mesh.pending} waiting for a peer to carry it.` : 'Shared with the mesh.'}</span>}
      </div>

      <h3>Family check-ins</h3>
      {!phrase.trim() ? (
        <p className="muted">Enter your phrase to look for family.</p>
      ) : !found.length ? (
        <p className="muted">Nobody has checked in with this phrase yet. Check-ins reach you as soon as any peer carries them.</p>
      ) : (
        <ul className="plain">
          {found.map((c) => (
            <li key={c.id}>
              <strong>{c.mine ? 'You are' : 'A family member is'}</strong> OK in {s.views.get(c.blockId)?.block.name ?? c.blockId} <span className="muted small">· {ago(c.wall)}</span>
            </li>
          ))}
        </ul>
      )}
      {other && (
        <div className="row">
          <button
            onClick={() => {
              store.setRouteTarget('family')
              store.setTab('routes')
            }}
          >
            Safe route to them
          </button>
        </div>
      )}
    </div>
  )
}
