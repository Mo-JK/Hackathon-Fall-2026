import { store } from '../store'
import type { Snapshot, Status } from '../store'
import { KIND_INFO, LEVELS, BLOCKS_PER_LEVEL, blockId } from '../sim/world'
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
        <h2>Directorate bulletin {!s.uplink && <em className="nosignal">NO SIGNAL · last update tick {s.official.tick}</em>}</h2>
        <p className="big">
          {num(s.official.cases)} <small>cases</small>
        </p>
        <p className="muted">"{s.official.headline}"</p>
        <p className="muted">{s.official.maintenanceLevels.length ? `${s.official.maintenanceLevels.length} levels under "maintenance"` : 'No incidents declared'}</p>
      </div>
      <div className="card lantern">
        <h2>Lantern: reported by residents and sensors</h2>
        <p className="big">
          ~{num(s.outbreak.estimatedCases)} <small>estimated cases</small>
        </p>
        <p className="muted">
          {critical} of {total} blocks critical, {watch} on watch
        </p>
        <p className="muted">{s.outbreak.clusters.length ? `${s.outbreak.clusters.length} outbreak cluster(s) detected` : 'No outbreak detected yet'}</p>
      </div>
    </section>
  )
}

export function MapView({ s }: { s: Snapshot }) {
  const levels = Array.from({ length: LEVELS }, (_, i) => i + 1)
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
            </div>
            {Array.from({ length: BLOCKS_PER_LEVEL }, (_, i) => {
              const v = s.views.get(blockId(level, i))!
              const here = v.block.id === s.homeBlock
              return (
                <button
                  key={v.block.id}
                  className={`cell ${v.status}${s.selected === v.block.id ? ' sel' : ''}${here ? ' home' : ''}`}
                  onClick={() => store.select(v.block.id)}
                  aria-label={`${v.block.name}: ${WORD[v.status]}. Official: ${v.officialStatus.toLowerCase()}`}
                  aria-pressed={s.selected === v.block.id}
                >
                  <span className="c1">
                    <span aria-hidden="true">{GLYPH[v.status]}</span> B{i + 1}
                    {here && <span className="you">you</span>}
                  </span>
                  <span className="c2">{WORD[v.status]}</span>
                  <span className="c3">{s.uplink ? `Official: ${v.officialStatus.toLowerCase()}` : 'Official: no signal'}</span>
                  {v.truth.flaggedKinds.length > 0 && <span className="c4">{v.truth.flaggedKinds.map((k) => KIND_INFO[k].label.split(' ')[0]).join(' · ')}</span>}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <p className="legend muted">
        <span aria-hidden="true">●</span> Normal <span aria-hidden="true">▲</span> Watch (warning or outbreak signal) <span aria-hidden="true">✖</span> Critical (corroborated by sensor or several independent residents)
      </p>
    </section>
  )
}
