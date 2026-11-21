import { store } from '../store'
import type { Snapshot } from '../store'
import type { BriefAction } from '../modules/briefing'

const LEVEL_WORD = { ok: 'All clear', watch: 'Watch', act: 'Act now' } as const
const GLYPH = { critical: '✖', warn: '▲', info: '●', good: '✓' } as const

function run(a: BriefAction) {
  if (a.respond) void store.respondTo(a.respond)
  else if (a.route) store.setRouteTarget(a.route)
  store.setTab(a.tab)
}

/** What the person holding this device needs to know and do about their own block, right now. */
export function YourBlock({ s }: { s: Snapshot }) {
  const b = s.brief
  const name = s.views.get(b.home)?.block.name ?? b.home
  return (
    <section className={`card yours ${b.level}`} aria-label="Your block">
      <header>
        <h2>
          Your block <span className="muted">{name}</span>
        </h2>
        <span className={`verdict ${b.level}`}>{LEVEL_WORD[b.level]}</span>
      </header>
      {!s.ready || s.tick === 0 ? (
        <p className="muted small">Press Start (or Run demo). Lantern will tell you here what is confirmed in your block, what is coming, where to go and who nearby needs help.</p>
      ) : (
        <ul className="brief">
          {b.items.map((it, i) => (
            <li key={i} className={it.tone}>
              <span className="bico" aria-hidden="true">
                {GLYPH[it.tone]}
              </span>
              <span className="btxt">{it.text}</span>
              {it.action && (
                <button className={it.action.respond ? 'small-btn danger-btn' : 'small-btn'} onClick={() => run(it.action!)}>
                  {it.action.label}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
