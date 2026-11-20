import { useMemo, useState } from 'react'
import { store, TAMPER_PROBE, TAMPER_SEQ } from '../store'
import type { Snapshot } from '../store'
import { num, pct } from '../hooks'
import { scheduleFans, TW_DANGER, TW_EXTREME } from '../modules/heat'
import type { Symptoms } from '../modules/care'
import { NO_SYMPTOMS, triage } from '../modules/care'
import { K_ANON } from '../modules/privacy'
import { lampRota, LIGHT_TARGET } from '../modules/light'
import { lampTradeoff } from '../modules/food'
import { AQI_MASK, AQI_UNSAFE, O2_MIN, REQUIRED_SKILLS, SAFE_DAYS_TO_OPEN } from '../modules/surface'
import type { RouteTarget } from '../modules/compute'
import { CLINICS, FARM_CUTOFF_LEVEL, FLOOD_CLOSED_CM, PROBES, SHAFTS } from '../sim/hollow'
import type { SosNeed, SpaceWhat } from '../types'

const f1 = (x: number) => x.toFixed(1)

// ---------- heat (3) ----------
export function HeatPanel({ s }: { s: Snapshot }) {
  const [budget, setBudget] = useState(40)
  const h = s.mod.heat
  const fans = useMemo(() => scheduleFans(h.rows, budget / 100), [h.rows, budget])
  const hot = [...h.rows].sort((a, b) => b.tw - a.tw).slice(0, 8)
  if (!h.rows.length) return <p className="muted pad">No readings yet. Press Start.</p>
  return (
    <div className="pad">
      <div className="compare">
        <div>
          <span className="muted small">Blocks in heat danger</span>
          <strong className={`big ${h.danger ? 'hot' : 'good'}`}>{h.danger}</strong>
          <span className="muted small">{num(h.peopleAtRisk)} people · {h.extreme} extreme</span>
        </div>
        <div>
          <span className="muted small">Cool refuges open</span>
          <strong className="big good">{h.refuges.length}</strong>
          <span className="muted small">wet-bulb under 28 °C and powered</span>
        </div>
      </div>
      <h3>Hottest blocks (wet-bulb)</h3>
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Air</th>
            <th>Humidity</th>
            <th>Wet-bulb</th>
            <th>Fans</th>
          </tr>
        </thead>
        <tbody>
          {hot.map((r) => {
            const fan = fans.find((x) => x.blockId === r.blockId)
            return (
              <tr key={r.blockId} onClick={() => store.select(r.blockId)} className={r.risk}>
                <td>{r.blockId}</td>
                <td>{f1(r.temp)} °C</td>
                <td>{Math.round(r.rh)}%</td>
                <td>
                  <strong>{f1(r.tw)} °C</strong> {r.risk !== 'ok' && <span className={`tag ${r.risk}`}>{r.risk}</span>}
                </td>
                <td>{fan ? pct(fan.coverage) : '-'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <label className="grow">
        Spare power for cooling fans: <strong>{budget}%</strong> of what the hot blocks need
        <input type="range" min={10} max={100} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
      </label>
      <p className="muted small">
        Wet-bulb combines heat and humidity (Stull 2011). Above {TW_DANGER} °C work is dangerous; near {TW_EXTREME} °C the body cannot cool itself. Fan power is split by heat risk × people, with the same max-min rule as power. Nearest cool refuge from your block: Routes tab.
      </p>
      <div className="row">
        <button
          onClick={() => {
            store.setRouteTarget('cool')
            store.setTab('routes')
          }}
        >
          Route me to a cool refuge
        </button>
      </div>
    </div>
  )
}

// ---------- Proof of Air (13) ----------
function AqiChart({ daily }: { daily: { day: number; aqi: number }[] }) {
  if (!daily.length) return null
  const W = 300
  const H = 90
  const max = 240
  const x = (d: number) => ((d - 1) / Math.max(1, daily.length - 1)) * W
  const y = (v: number) => H - (Math.min(v, max) / max) * H
  const path = daily.map((d, i) => `${i ? 'L' : 'M'}${x(d.day).toFixed(1)},${y(d.aqi).toFixed(1)}`).join(' ')
  return (
    <svg className="aqi" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y={y(AQI_MASK)} width={W} height={H - y(AQI_MASK)} className="band-ok" />
      <line x1="0" x2={W} y1={y(AQI_UNSAFE)} y2={y(AQI_UNSAFE)} className="crit" />
      <path d={path} className="line" />
    </svg>
  )
}

export function SurfacePanel({ s }: { s: Snapshot }) {
  const sf = s.mod.surface
  const [open, setOpen] = useState<string | null>(null)
  return (
    <div className="pad">
      <div className="compare">
        <div className="official-box">
          <span className="muted small">Directorate</span>
          <strong className="big">"Lethal in minutes"</strong>
          <span className="muted small">no data published in 30 years</span>
        </div>
        <div>
          <span className="muted small">Probe evidence</span>
          <strong className={`big ${sf.best ? 'good' : 'hot'}`}>{sf.best ? `AQI ${Math.round(sf.best.last7)} ± ${Math.round(sf.best.ci)}` : 'unverified'}</strong>
          <span className="muted small">{sf.best ? `Shaft ${sf.best.probe}, last 7 days, ${sf.best.daysSafe} days in a row under ${AQI_MASK}` : 'no chain checks out yet'}</span>
        </div>
      </div>

      {PROBES.map((p) => {
        const a = sf.assessments.find((x) => x.probe === p.id)!
        const v = sf.verified.get(p.id)
        const check = s.chain.get(p.id)
        const busy = s.chainBusy === p.id
        return (
          <div key={p.id} className={`probe ${v === false ? 'broken' : ''}`}>
            <div className="probe-head">
              <strong>{p.name}</strong>
              <span className={`tag ${a.verdict}`}>{a.verdict === 'mask' ? 'breathable with filter mask' : a.verdict}</span>
              <span className={`chain ${v === true ? 'ok' : v === false ? 'bad' : ''}`}>
                {busy ? 'verifying…' : v === true ? `✔ ${check!.ok} entries verified` : v === false ? `✖ chain broken at entry ${check!.firstBad}` : 'not checked'}
              </span>
            </div>
            <AqiChart daily={a.daily} />
            <p className="muted small">
              {a.days} days · last 7 days AQI {Math.round(a.last7)} ± {Math.round(a.ci)} · trend {a.slope > 0 ? '+' : ''}
              {f1(a.slope)}/day · O₂ min {a.minO2.toFixed(2)}% (need {O2_MIN}%)
            </p>
            <div className="row">
              <button onClick={() => void store.verifyProbe(p.id)} disabled={busy}>
                Re-verify chain
              </button>
              <button onClick={() => setOpen(open === p.id ? null : p.id)}>{open === p.id ? 'Hide log' : 'Show log'}</button>
            </div>
            {open === p.id && <ChainLog s={s} probe={p.id} />}
          </div>
        )
      })}

      <h3>Try to forge the record</h3>
      <p className="muted small">
        Edit one old reading (Shaft {TAMPER_PROBE}, entry {TAMPER_SEQ}) to make the air look deadly. Its signature no longer matches, and every later entry's link breaks.
      </p>
      <button onClick={() => void store.tamper()} disabled={s.tampered || !!s.chainBusy}>
        {s.tampered ? 'Reading forged (Reset restores it)' : 'Forge one reading'}
      </button>
      <p className="muted small">
        Each reading is signed by its probe's key and carries the hash of the reading before. Anyone can re-check all {num(PROBES.length * 164)} entries offline. Lantern shows the evidence and how sure it is; it does not declare the surface safe.
      </p>
    </div>
  )
}

function ChainLog({ s, probe }: { s: Snapshot; probe: string }) {
  const ledger = store.probeLedger(probe)
  const check = s.chain.get(probe)
  const from = check && check.firstBad >= 0 ? Math.max(0, check.firstBad - 2) : ledger.length - 6
  return (
    <ol className="log" start={from}>
      {ledger.slice(from, from + 6).map((m, i) => {
        const st = check?.statuses[from + i]
        return (
          <li key={m.id} className={st ?? ''}>
            <span className="mono">#{m.data.seq}</span> day {m.data.day} · AQI {m.data.aqi} · O₂ {m.data.o2}% <span className="mono muted">prev {m.data.prev.slice(0, 8) || '∅'}</span> <span className="st">{st ?? '?'}</span>
          </li>
        )
      })}
    </ol>
  )
}

// ---------- care (9, 10) ----------
const QUESTIONS: [keyof Symptoms, string][] = [
  ['cough', 'Cough'],
  ['fever', 'Fever'],
  ['breathlessAtRest', 'Short of breath at rest'],
  ['chestPain', 'Chest pain'],
  ['blueLips', 'Blue or grey lips'],
  ['confusion', 'New confusion'],
  ['over65', 'Over 65'],
  ['lungCondition', 'Existing lung condition'],
]

export function CarePanel({ s }: { s: Snapshot }) {
  const [sym, setSym] = useState<Symptoms>(NO_SYMPTOMS)
  const [shared, setShared] = useState(false)
  const result = triage(sym)
  const c = s.mod.care
  const route = s.mod.clinicRoute
  const word = { self: 'Self-care', medicine: 'Needs medicine', clinic: 'Go to a clinic' } as const
  return (
    <div className="pad">
      <h3>Symptom checklist (not a diagnosis)</h3>
      <div className="checks">
        {QUESTIONS.map(([k, label]) => (
          <label key={k}>
            <input type="checkbox" checked={!!sym[k]} onChange={(e) => (setShared(false), setSym({ ...sym, [k]: e.target.checked }))} /> {label}
          </label>
        ))}
        <label>
          Days unwell <input type="number" min={0} max={30} value={sym.days} onChange={(e) => (setShared(false), setSym({ ...sym, days: Number(e.target.value) }))} />
        </label>
      </div>
      <div className={`triage ${result.outcome}`}>
        <strong>{word[result.outcome]}</strong>
        <span className="small">{result.reasons.join(' ')}</span>
        {result.outcome === 'clinic' && route && (
          <span className="small">
            Nearest clinic: {route.path[route.path.length - 1]}, {num(route.length)} m via {route.path.join(' → ')}
          </span>
        )}
      </div>
      <div className="row">
        <button onClick={() => void store.sendTriage(result.outcome).then(() => setShared(true))} disabled={!s.ready}>
          Share outcome only (from {s.homeBlock})
        </button>
        {shared && <span className="muted small">Shared. Your answers stayed on this device.</span>}
      </div>

      <h3>Medicine demand from triage</h3>
      {!c.rows.length ? (
        <p className="muted small">No triage outcomes yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Block</th>
              <th>Self-care</th>
              <th>Medicine</th>
              <th>Clinic</th>
            </tr>
          </thead>
          <tbody>
            {c.rows
              .slice()
              .sort((a, b) => b.medicine + b.clinic - (a.medicine + a.clinic))
              .slice(0, 8)
              .map((r) =>
                r.hidden ? (
                  <tr key={r.blockId}>
                    <td>{r.blockId}</td>
                    <td colSpan={3} className="muted small">
                      hidden: fewer than {K_ANON} devices
                    </td>
                  </tr>
                ) : (
                  <tr key={r.blockId} onClick={() => store.select(r.blockId)}>
                    <td>{r.blockId}</td>
                    <td>{r.self}</td>
                    <td>{r.medicine}</td>
                    <td>{r.clinic}</td>
                  </tr>
                ),
              )}
          </tbody>
        </table>
      )}
      <p className="muted small">
        {c.demand.reduce((x, d) => x + d.courses, 0)} courses of medicine needed across {c.demand.length} blocks; {c.hiddenBlocks} block(s) withheld for privacy. Clinics: {CLINICS.join(', ')}. Routes avoid flooded and dangerously hot tunnels.
      </p>
    </div>
  )
}

// ---------- food (12) ----------
export function FoodPanel({ s }: { s: Snapshot }) {
  const [lampShare, setLampShare] = useState(30)
  const f = s.mod.food
  const cut = f.rows.filter((r) => r.level === FARM_CUTOFF_LEVEL)
  const trade = lampTradeoff(lampShare / 100, cut, s.mod.heat.peopleAtRisk)
  const worst = [...f.rows].sort((a, b) => a.days - b.days).slice(0, 6)
  if (!f.rows.length) return <p className="muted pad">The food ledger fills in as blocks log their pantries. Press Start.</p>
  return (
    <div className="pad">
      <p className={f.cutOff ? 'status off' : 'status on'}>
        {f.cutOff ? `Central farms have cut off Level ${FARM_CUTOFF_LEVEL}.` : `Ledger: ${f.rows.length} blocks logged pantries and grow plots.`}
      </p>
      <h3>Days of food if the farms cut us off</h3>
      <ul className="bars">
        {worst.map((r) => (
          <li key={r.blockId}>
            <span className="lbl">{r.blockId}</span>
            <span className="pair">
              <span className={`bar ${r.days < 3 ? 'today' : 'fair'}`} style={{ width: `${Math.min(100, (r.days / 20) * 100)}%` }}>
                <i>{f1(r.days)} days</i>
              </span>
            </span>
          </li>
        ))}
      </ul>
      <h3>Share within the district (Levels {FARM_CUTOFF_LEVEL - 1}-{FARM_CUTOFF_LEVEL + 1})</h3>
      <p className="small">
        Worst block: <strong className="hot">{f1(f.balance.before)} days</strong> → everyone: <strong className="good">{f1(f.balance.after)} days</strong> of pantry stock.
      </p>
      <ul className="plain small">
        {f.balance.transfers.slice(0, 5).map((t) => (
          <li key={`${t.from}-${t.to}`}>
            {t.from} → {t.to}: {num(t.kg)} kg
          </li>
        ))}
      </ul>
      <h3>Power trade-off: grow lamps vs fans</h3>
      <label className="grow">
        Spare power to grow lamps on Level {FARM_CUTOFF_LEVEL}: <strong>{lampShare}%</strong>
        <input type="range" min={0} max={100} value={lampShare} onChange={(e) => setLampShare(Number(e.target.value))} />
      </label>
      <p className="small">
        Level {FARM_CUTOFF_LEVEL} food lasts <strong>{f1(trade.days)} days</strong>; fans withdrawn from <strong>{num(trade.peopleLosingFans)}</strong> people in heat danger. Every watt has a cost: Lantern makes it visible.
      </p>
    </div>
  )
}

// ---------- space (6) ----------
export function SpacePanel({ s }: { s: Snapshot }) {
  const sp = s.mod.space
  const [what, setWhat] = useState<SpaceWhat>('sleep')
  const crowd = [...sp.crowd].sort((a, b) => b.perRoom - a.perRoom)
  const byLevel = Array.from({ length: 12 }, (_, i) => {
    const rows = sp.crowd.filter((c) => c.level === i + 1)
    return rows.reduce((x, r) => x + r.perRoom, 0) / rows.length
  })
  return (
    <div className="pad">
      <div className="compare">
        <div>
          <span className="muted small">Most crowded</span>
          <strong className="big hot">{f1(crowd[0].perRoom)}</strong>
          <span className="muted small">people per room in {crowd[0].blockId}</span>
        </div>
        <div>
          <span className="muted small">Space board matches</span>
          <strong className="big good">{sp.result.served}</strong>
          <span className="muted small">
            of {sp.result.served + sp.result.unmatched} requested slots · {sp.result.openOffers} offers open
          </span>
        </div>
      </div>
      <h3>People per room, by level</h3>
      <div className="heatstrip" aria-label="Crowding by level">
        {byLevel.map((v, i) => (
          <span key={i} style={{ ['--v' as string]: Math.min(1, (v - 1.5) / 3) }} title={`L${i + 1}: ${f1(v)} per room`}>
            L{i + 1}
            <b>{f1(v)}</b>
          </span>
        ))}
      </div>
      <h3>Latest matches</h3>
      <ul className="plain small">
        {sp.result.matches.slice(-6).reverse().map((m) => (
          <li key={`${m.requestId}-${m.offerId}`}>
            {m.slots} {m.what} slot{m.slots === 1 ? '' : 's'}: {m.from} → {m.to} ({m.hops} hop{m.hops === 1 ? '' : 's'})
          </li>
        ))}
        {!sp.result.matches.length && <li className="muted">No matches yet.</li>}
      </ul>
      <div className="row">
        <select value={what} onChange={(e) => setWhat(e.target.value as SpaceWhat)} aria-label="Kind of space">
          <option value="sleep">bed shift</option>
          <option value="quiet">quiet room</option>
          <option value="cool">cool room</option>
        </select>
        <button onClick={() => void store.postSpace('offer', what, 2)}>Offer 2</button>
        <button onClick={() => void store.postSpace('request', what, 1)}>Ask for 1</button>
      </div>
      <p className="muted small">Rule: most crowded and deepest first (people per room × hardship, doubled for cool rooms in heat danger), matched to the nearest offer within 3 tunnel hops.</p>
    </div>
  )
}

// ---------- light & body (11) ----------
export function LightPanel({ s }: { s: Snapshot }) {
  const [hours, setHours] = useState(200)
  const [sleep, setSleep] = useState(6)
  const [mood, setMood] = useState(3)
  const [light, setLight] = useState(20)
  const l = s.mod.light
  const rota = useMemo(() => lampRota(store.blocks, l.rows, hours), [l.rows, hours])
  const vis = l.rows.filter((r) => !r.hidden)
  if (!vis.length) return <p className="muted pad">Pulses arrive as residents tap in. Press Start.</p>
  const max = Math.max(...vis.map((r) => r.light), LIGHT_TARGET)
  return (
    <div className="pad">
      <div className="compare">
        <div>
          <span className="muted small">Depth vs mood</span>
          <strong className="big hot">r = {l.corrMood.toFixed(2)}</strong>
          <span className="muted small">deeper levels report worse mood</span>
        </div>
        <div>
          <span className="muted small">Depth vs daylight</span>
          <strong className="big hot">r = {l.corrLight.toFixed(2)}</strong>
          <span className="muted small">{num(l.pulses)} anonymous pulses</span>
        </div>
      </div>
      <h3>Bright light per day, by level (target {LIGHT_TARGET} min)</h3>
      <ul className="bars">
        {l.rows.map((r) => (
          <li key={r.level}>
            <span className="lbl">L{r.level}</span>
            {r.hidden ? (
              <span className="muted small">hidden (&lt;{K_ANON} devices)</span>
            ) : (
              <span className="pair">
                <span className={`bar ${r.light < LIGHT_TARGET ? 'today' : 'fair'}`} style={{ width: `${(r.light / max) * 100}%` }}>
                  <i>
                    {Math.round(r.light)} min · sleep {f1(r.sleep)} h · mood {f1(r.mood)}
                  </i>
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
      <label className="grow">
        Full-spectrum lamp hours to share today: <strong>{hours}</strong>
        <input type="range" min={20} max={600} step={10} value={hours} onChange={(e) => setHours(Number(e.target.value))} />
      </label>
      <p className="small">
        Lamp rota (fair by light deficit × people):{' '}
        {rota
          .filter((r) => r.hours > 0.5)
          .map((r) => `L${r.level} ${Math.round(r.hours)} h`)
          .join(' · ') || 'nobody below target'}
      </p>
      <h3>Send your pulse</h3>
      <div className="row small">
        <label>
          Sleep <input type="number" min={0} max={14} value={sleep} onChange={(e) => setSleep(Number(e.target.value))} /> h
        </label>
        <label>
          Mood <input type="number" min={1} max={5} value={mood} onChange={(e) => setMood(Number(e.target.value))} />
        </label>
        <label>
          Light <input type="number" min={0} max={240} value={light} onChange={(e) => setLight(Number(e.target.value))} /> min
        </label>
        <button onClick={() => void store.sendPulse(sleep, mood, light)}>Send</button>
      </div>
    </div>
  )
}

// ---------- the way up (14, 15) ----------
export function ReturnPanel({ s }: { s: Snapshot }) {
  const r = s.mod.ret
  const opts = s.mod.surface.options
  const c = s.mod.cohort
  const maxDay = Math.max(1, ...[...r.upper.finish.values(), ...r.fair.finish.values()].filter(Number.isFinite))
  const deep = r.levels[r.levels.length - 1].level
  const dFair = r.fair.finish.get(deep) ?? Infinity
  const dUp = r.upper.finish.get(deep) ?? Infinity
  return (
    <div className="pad">
      <h3>14 · What to go up in</h3>
      <table>
        <thead>
          <tr>
            <th>Option</th>
            <th>Risk</th>
            <th>Holds</th>
            <th>Ready in</th>
            <th>Score</th>
          </tr>
        </thead>
        <tbody>
          {opts.map((o, i) => (
            <tr key={o.id} className={o.viable ? (i === 0 ? 'pick' : '') : 'dim'}>
              <td>
                {o.name} {i === 0 && o.viable && <span className="tag mask">first wave</span>}
              </td>
              <td>{pct(o.risk)}</td>
              <td>{o.capacity}</td>
              <td>{o.buildDays} d</td>
              <td>{o.viable ? o.score.toFixed(2) : 'not viable'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Published weights: 40% safety (from verified probe evidence), 20% capacity, 20% speed, 20% cost. Without verified evidence nothing is viable.</p>

      <h3>First cohort ({c.picks.length} of {c.eligible} consenting volunteers)</h3>
      <ul className="cohort">
        {c.picks.map((p) => (
          <li key={p.volunteer.id}>
            <span className="mono">{p.volunteer.id}</span> L{p.volunteer.level} · {p.volunteer.skills.join(', ')} <span className="muted small">({p.why}, score {p.score.toFixed(2)})</span>
          </li>
        ))}
      </ul>
      <p className="muted small">
        Rule: consent required ({c.declined} declined and are never picked); one seat each for the best {REQUIRED_SKILLS.join(', ')}; the rest by 40% health + 35% skills + 25% stated risk acceptance. Depth never counts against anyone.
      </p>

      <h3>15 · The return plan</h3>
      <p className="small">
        Open shafts: {r.open.length ? r.open.map((id) => SHAFTS.find((x) => x.id === id)!.name).join(', ') : <strong className="hot">none</strong>} · a shaft opens after {SAFE_DAYS_TO_OPEN} straight days of verified safe air.
      </p>
      {r.open.length ? (
        <>
          <p className="small">
            Level {deep} reaches the surface by <strong className="good">day {Number.isFinite(dFair) ? dFair : '–'}</strong> under the fair plan vs{' '}
            <strong className="hot">day {Number.isFinite(dUp) ? dUp : '–'}</strong> upper-levels-first.
          </p>
          <ul className="gantt" aria-label="Days each level moves">
            {r.levels.map((l) => {
              const row = (p: typeof r.fair) => {
                const st = p.start.get(l.level) ?? Infinity
                const fi = p.finish.get(l.level) ?? Infinity
                return Number.isFinite(st) ? { left: ((st - 1) / maxDay) * 100, width: ((fi - st + 1) / maxDay) * 100 } : null
              }
              const a = row(r.upper)
              const b = row(r.fair)
              return (
                <li key={l.level}>
                  <span className="lbl">L{l.level}</span>
                  <span className="lanes">
                    {a ? <span className="g today" style={{ left: `${a.left}%`, width: `${a.width}%` }} /> : <span className="muted small">no open shaft</span>}
                    {b && <span className="g fair" style={{ left: `${b.left}%`, width: `${b.width}%` }} />}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="muted small">
            <span className="key today" /> upper levels first <span className="key fair" /> fair (lift capacity shared by remaining people × hardship, then max-flow through open shafts). Day 1 to day {maxDay}.
          </p>
        </>
      ) : (
        <p className="muted small">No stage can open: the probe evidence is missing, unsafe, or failed verification.</p>
      )}
    </div>
  )
}

// ---------- routes & SOS (5, 7, 8, 10) ----------
const TARGETS: { id: RouteTarget; label: string }[] = [
  { id: 'clinic', label: 'Clinic' },
  { id: 'water', label: 'Safe water' },
  { id: 'cool', label: 'Cool refuge' },
  { id: 'family', label: 'Family' },
]

export function RoutesPanel({ s }: { s: Snapshot }) {
  const r = s.mod.route
  const fl = s.mod.flood
  const [need, setNeed] = useState<SosNeed>('medical')
  return (
    <div className="pad">
      <div className="row">
        <span className="muted small">From {s.homeBlock} to:</span>
        {TARGETS.map((t) => (
          <button key={t.id} className={s.routeTarget === t.id ? 'active-btn' : ''} onClick={() => store.setRouteTarget(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {r.route ? (
        <div className="route">
          <strong>
            {r.route.path[r.route.path.length - 1]} · {num(r.route.length)} m
          </strong>
          <ol>
            {r.route.path.map((id, i) => (
              <li key={id + i}>
                {id}
                {(s.mod.hazards.blockCost.get(id) ?? 1) > 1 && <span className="tag danger">hazard</span>}
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <p className="muted">{r.target === 'family' ? 'No family check-in found yet: enter your phrase on the Family tab.' : 'No safe route found.'}</p>
      )}
      <h3>Tunnel status (flood gauges)</h3>
      <ul className="plain small">
        {[...fl.depth].map(([edge, d]) => (
          <li key={edge} className={fl.closed.has(edge) ? 'hot' : fl.atRisk.has(edge) ? 'warnc' : ''}>
            {edge.replace('|', ' ↔ ')}: {d} cm {fl.closed.has(edge) ? '· CLOSED' : fl.atRisk.has(edge) ? '· at risk (downhill of a flood)' : ''}
          </li>
        ))}
        {!fl.depth.size && <li className="muted">No gauge readings yet.</li>}
      </ul>
      <p className="muted small">Segments close at {FLOOD_CLOSED_CM} cm. Dark blocks cost 1.5×, dangerously hot 2-3×. Water runs downhill, so stairs below a flooded segment are flagged at risk before they go under.</p>

      <h3>SOS calls ({s.mod.sos.length})</h3>
      <ul className="plain small">
        {s.mod.sos.slice(0, 6).map((x) => (
          <li key={x.id}>
            <span className="sos-dot" /> {x.blockId}: {x.data.need} {x.virtual ? '' : <span className="tag mask">real device</span>}
          </li>
        ))}
        {!s.mod.sos.length && <li className="muted">No calls for help.</li>}
      </ul>
      <div className="row">
        <select value={need} onChange={(e) => setNeed(e.target.value as SosNeed)} aria-label="Kind of help">
          <option value="medical">medical</option>
          <option value="trapped">trapped</option>
          <option value="water">no water</option>
          <option value="heat">heat</option>
        </select>
        <button className="danger-btn" onClick={() => void store.sendSos(need)} disabled={!s.ready}>
          Send SOS from {s.homeBlock}
        </button>
      </div>
    </div>
  )
}
