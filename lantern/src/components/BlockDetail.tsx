import { store } from '../store'
import type { Snapshot } from '../store'
import { isBeyond, KIND_INFO, KINDS } from '../sim/world'
import type { Kind } from '../types'
import { num } from '../hooks'
import { TRUST_THRESHOLD } from '../engine/trust'

function Spark({ values, kind }: { values: number[]; kind: Kind }) {
  const pts = values.slice(-40)
  if (pts.length < 2) return <svg className="spark" viewBox="0 0 100 28" aria-hidden="true" />
  const { critical } = KIND_INFO[kind]
  const lo = Math.min(...pts, critical)
  const hi = Math.max(...pts, critical)
  const y = (v: number) => 26 - ((v - lo) / (hi - lo || 1)) * 24
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * 100},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg className="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2="100" y1={y(critical)} y2={y(critical)} className="crit" />
      <path d={path} className="line" />
    </svg>
  )
}

export function BlockDetail({ s }: { s: Snapshot }) {
  const v = s.selected ? s.views.get(s.selected) : undefined
  if (!v)
    return (
      <section className="detail card">
        <p className="muted">Select a block on the map to see its sensors, evidence and reports.</p>
      </section>
    )
  const b = v.block
  const isHome = b.id === s.homeBlock
  const heat = s.mod.heat.rows.find((r) => r.blockId === b.id)
  return (
    <section className="detail card" aria-label={`Details for ${b.name}`}>
      <header>
        <h2>{b.name}</h2>
        <span className="muted">
          {num(b.population)} residents · hardship ×{b.hardship} · {b.hasSensor ? 'sensor installed' : 'no sensor: relies on resident reports'}
          {heat && ` · wet-bulb ${heat.tw.toFixed(1)} °C`}
        </span>
      </header>
      <div className="kinds">
        {KINDS.map((k) => {
          const info = KIND_INFO[k]
          const series = store.series(b.id, k)
          const last = series[series.length - 1]
          const ev = v.truth.evidence[k]
          return (
            <div key={k} className={`kind${ev.flagged ? ' flagged' : ''}`}>
              <div className="kname">{info.label}</div>
              <div className="kval">{last === undefined ? 'n/a' : `${last.toFixed(info.digits)}${info.unit}`}</div>
              <Spark values={series} kind={k} />
              <div className="muted small">{last !== undefined && isBeyond(k, last) ? 'past critical line' : `critical at ${info.critical}${info.unit}`}</div>
              <div className="muted small" title="Evidence needed to change the map">
                evidence {ev.weight.toFixed(1)}/{TRUST_THRESHOLD}
                {ev.sensor ? ' · sensor' : ''}
                {ev.trustedWeight > 0 ? ` · residents ${ev.trustedWeight.toFixed(1)}` : ''}
                {ev.newcomers > 0 ? ` · ${ev.newcomers} new keys capped ${ev.newcomerWeight.toFixed(1)}` : ''}
              </div>
            </div>
          )
        })}
      </div>
      <p className="muted small">
        Symptom reports in the last hour: {v.outbreak.recent} (normal for this block: ~{v.outbreak.expected.toFixed(1)}).
      </p>
      <div className="actions">
        <button onClick={() => store.setHome(b.id)} disabled={isHome}>
          {isHome ? 'This is your block' : 'I live here'}
        </button>
        <span className="muted small">Report from {s.homeBlock}:</span>
        <button onClick={() => void store.submitReport('outage')}>Power flickering</button>
        <button onClick={() => void store.submitReport('water_taste')}>Water tastes wrong</button>
        <button onClick={() => void store.submitReport('symptom')}>I have a cough</button>
      </div>
    </section>
  )
}
