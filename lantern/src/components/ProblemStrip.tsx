import { store } from '../store'
import type { Snapshot } from '../store'
import { PROBLEMS, TABS } from '../modules/registry'

/** The brief's 15 problems. Each lights up once the module that answers it has been shown. */
export function ProblemStrip({ s }: { s: Snapshot }) {
  const nums = Object.keys(PROBLEMS).map(Number)
  return (
    <nav className="strip" aria-label="The 15 problems in the brief">
      <span className="strip-label">
        {s.lit.size}/15 <small>problems answered</small>
      </span>
      {nums.map((n) => {
        const tab = TABS.find((t) => t.problems.includes(n))
        return (
          <button key={n} className={`chip${s.lit.has(n) ? ' lit' : ''}`} title={`${n}. ${PROBLEMS[n]}`} onClick={() => tab && store.setTab(tab.id)}>
            {n}
          </button>
        )
      })}
    </nav>
  )
}
