import { store } from '../store'
import type { Snapshot, Status } from '../store'
import { KIND_INFO, LEVELS, BLOCKS_PER_LEVEL, blockId } from '../sim/world'
import { CLINICS, FARM_CUTOFF_LEVEL } from '../sim/hollow'
import { num } from '../hooks'

const GLYPH: Record<Status, string> = { ok: '●', warn: '▲', critical: '✖' }
const WORD: Record<Status, string> = { ok: 'Normal', warn: 'Watch', critical: 'Critical' }

export function TruthGap({ s }: { s: Snapshot }) {
  let critical = 0
  let watch = 0
  s.views.forEach((v) => {
    if (v.status === 'critical') critical++
    else if (v.status === 'warn') watch++
  })
  const total = s.views.size
  return (
    <section className="gap" aria-label="Official versus reported">
      <div className="card official">
        <h2>Directorate view {!s.uplink && <em className="nosignal">NO SIGNAL · last update tick {s.official.tick}</em>}</h2>
        <p className="big">
          {num(s.official.cases)} <small>cases</small>
        </p>
        <p className="muted">"{s.official.headline}"</p>
        <p className="muted">{s.official.maintenanceLevels.length ? `${s.official.maintenanceLevels.length} levels under "maintenance"` : 'No incidents declared'}</p>
      </div>
      <div className="card lantern">
        <h2>Lantern view: residents and sensors</h2>
        <p className="big">
          ~{num(s.outbreak.estimatedCases)} <small>estimated cases</small>
        </p>
        <p className="muted">
          {critical} of {total} blocks critical, {watch} on watch{s.mod.heat.danger ? `, ${s.mod.heat.danger} in heat danger` : ''}
        </p>
        <p className="muted">
          {s.outbreak.clusters.length ? `${s.outbreak.clusters.length} outbreak cluster(s)` : 'No outbreak detected yet'}
          {s.mod.sos.length ? ` · ${s.mod.sos.length} SOS` : ''}
          {s.mod.flood.closed.size ? ` · ${s.mod.flood.closed.size} tunnel(s) flooded` : ''}
        </p>
      </div>
    </section>
  )
}

export function MapView({ s }: { s: Snapshot }) {
  const levels = Array.from({ length: LEVELS }, (_, i) => i + 1)
  const route = s.mod.route.route?.path ?? []
  const sos = new Set(s.mod.sos.map((x) => x.blockId))
  const heat = new Map(s.mod.heat.rows.map((r) => [r.blockId, r.risk]))
  const flooded = new Set<string>()
  for (const e of s.mod.flood.closed) for (const id of e.split('|')) flooded.add(id)
  return (
    <section className="map" aria-label="Map of the Hollow, level by level">
      <h2>
        The Hollow <span className="muted">surface above, deepest level at the bottom</span>
      </h2>
      <div className="levels">
        {levels.map((level) => (
          <div key={level} className="level" style={{ ['--depth' as string]: (level - 1) / (LEVELS - 1) }}>
            <div className="lvl-label">
              <b>L{level}</b>
              {level === FARM_CUTOFF_LEVEL && s.mod.food.cutOff && <span title="Central farms cut off">🌾✖</span>}
            </div>
            {Array.from({ length: BLOCKS_PER_LEVEL }, (_, i) => {
              const v = s.views.get(blockId(level, i))!
              const id = v.block.id
              const here = id === s.homeBlock
              const step = route.indexOf(id)
              const hr = heat.get(id)
              return (
                <button
                  key={id}
                  className={`cell ${v.status}${s.selected === id ? ' sel' : ''}${here ? ' home' : ''}${step >= 0 ? ' onroute' : ''}`}
                  onClick={() => store.select(id)}
                  aria-label={`${v.block.name}: ${WORD[v.status]}. Official: ${v.officialStatus.toLowerCase()}`}
                  aria-pressed={s.selected === id}
                >
                  <span className="c1">
                    <span aria-hidden="true">{GLYPH[v.status]}</span> B{i + 1}
                    {here && <span className="you">you</span>}
                    {step > 0 && <span className="step">{step}</span>}
                    {sos.has(id) && <span className="sos" title="SOS call" />}
                  </span>
                  <span className="c2">{WORD[v.status]}</span>
                  <span className="c3">{s.uplink ? `Official: ${v.officialStatus.toLowerCase()}` : 'Official: no signal'}</span>
                  <span className="c4">
                    {v.truth.flaggedKinds.map((k) => KIND_INFO[k].label.split(' ')[0]).join(' · ')}
                    {hr && hr !== 'ok' && <em className={`hz ${hr}`}>heat</em>}
                    {flooded.has(id) && <em className="hz flood">flood</em>}
                    {CLINICS.includes(id) && <em className="hz clinic">clinic</em>}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="legend muted">
        <span aria-hidden="true">●</span> Normal <span aria-hidden="true">▲</span> Watch <span aria-hidden="true">✖</span> Critical (corroborated) · numbered cells: safe route from your block · pulsing dot: SOS
      </p>
    </section>
  )
}
