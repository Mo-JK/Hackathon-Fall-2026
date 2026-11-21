import { useEffect, useState } from 'react'
import { store } from './store'
import type { Snapshot, TabId } from './store'
import { useSnap } from './hooks'
import { Header } from './components/Header'
import { MapView, TruthGap } from './components/MapView'
import { BlockDetail } from './components/BlockDetail'
import { YourBlock } from './components/YourBlock'
import { AlertsPanel, FamilyPanel, MeshPanel, OutbreakPanel, SharePanel } from './components/Panels'
import { CarePanel, FoodPanel, HeatPanel, LightPanel, ReturnPanel, RoutesPanel, SpacePanel, SurfacePanel } from './components/ModulePanels'
import { ProblemStrip } from './components/ProblemStrip'
import { JoinModal } from './components/Join'
import { Pitch } from './components/Pitch'
import { PhoneApp } from './phone/PhoneApp'
import { GROUPS, groupOf, TABS } from './modules/registry'
import { stopDemo } from './demo'

const PANELS: Record<TabId, (p: { s: Snapshot }) => React.JSX.Element> = {
  alerts: AlertsPanel,
  outbreak: OutbreakPanel,
  heat: HeatPanel,
  surface: SurfacePanel,
  share: SharePanel,
  care: CarePanel,
  food: FoodPanel,
  space: SpacePanel,
  light: LightPanel,
  return: ReturnPanel,
  mesh: MeshPanel,
  routes: RoutesPanel,
  family: FamilyPanel,
}

const isPhone = () => new URLSearchParams(location.search).has('phone')

function useHash() {
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const on = () => setHash(location.hash)
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return hash
}

export default function App() {
  if (isPhone()) return <PhoneApp />
  return <Main />
}

function Main() {
  const s = useSnap()
  const hash = useHash()
  const [join, setJoin] = useState(false)

  useEffect(() => {
    void store.init()
  }, [])

  if (hash.startsWith('#/pitch')) return <Pitch s={s} />

  const group = groupOf(s.tab)
  const Panel = PANELS[s.tab]
  return (
    <div className="app">
      <Header s={s} onJoin={() => setJoin(true)} />
      <ProblemStrip s={s} />

      {s.demo.active && (
        <div className="demo-bar" role="status">
          <div className="demo-step">
            {s.demo.step}/{s.demo.steps}
          </div>
          <div>
            <strong>{s.demo.title}</strong>
            <p>{s.demo.caption}</p>
          </div>
          <button onClick={stopDemo}>Stop</button>
        </div>
      )}

      {s.feed.length > 0 && (
        <div className="feed" role="log" aria-live="polite">
          <span className="live">LIVE</span> {s.feed[0].text}
          {s.feed.length > 1 && <span className="muted small"> · {s.feed.length - 1} earlier</span>}
        </div>
      )}

      {!s.ready && <p className="loading">Generating device keys for the simulated mesh...</p>}

      <main>
        <div className="left">
          <TruthGap s={s} />
          <YourBlock s={s} />
          <MapView s={s} />
          <BlockDetail s={s} />
        </div>
        <aside className="right card">
          <div className="groups" role="tablist" aria-label="Engines">
            {GROUPS.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={group === g.id}
                className={group === g.id ? `grp active ${g.id}` : `grp ${g.id}`}
                onClick={() => store.setTab(TABS.find((t) => t.group === g.id)!.id)}
                title={g.blurb}
              >
                {g.label}
                <small>{g.blurb}</small>
              </button>
            ))}
          </div>
          <div className="tabs" role="tablist">
            {TABS.filter((t) => t.group === group).map((t) => (
              <button key={t.id} role="tab" aria-selected={s.tab === t.id} className={s.tab === t.id ? 'active' : ''} onClick={() => store.setTab(t.id)}>
                {t.label}
                <span className="pnum">{t.problems.join('·')}</span>
                {t.id === 'alerts' && s.alerts.length > 0 && <span className="count">{s.alerts.length}</span>}
                {t.id === 'routes' && s.mod.sos.length > 0 && <span className="count">{s.mod.sos.length}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            <Panel s={s} />
          </div>
        </aside>
      </main>

      <footer>
        All data is simulated: sensors, the 300 other devices, probes and the radio. Signing, gossip, the relay, reputation, the trust rule and every engine are real code. <a href="#/pitch">Slides</a>
      </footer>

      {join && <JoinModal s={s} onClose={() => setJoin(false)} />}
    </div>
  )
}
