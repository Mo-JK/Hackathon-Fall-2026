import { useEffect } from 'react'
import { store } from './store'
import { useSnap } from './hooks'
import { Header } from './components/Header'
import { MapView, TruthGap } from './components/MapView'
import { BlockDetail } from './components/BlockDetail'
import { AlertsPanel, FamilyPanel, MeshPanel, OutbreakPanel, SharePanel, TABS } from './components/Panels'
import { stopDemo } from './demo'

export default function App() {
  const s = useSnap()

  useEffect(() => {
    void store.init()
  }, [])

  return (
    <div className="app">
      <Header s={s} />

      {s.demo.active && (
        <div className="demo-bar" role="status">
          <div className="demo-step">
            Demo {s.demo.step}/{s.demo.steps}
          </div>
          <div>
            <strong>{s.demo.title}</strong>
            <p>{s.demo.caption}</p>
          </div>
          <button onClick={stopDemo}>Stop</button>
        </div>
      )}

      {!s.ready && <p className="loading">Generating device keys for the simulated mesh...</p>}

      <main>
        <div className="left">
          <TruthGap s={s} />
          <MapView s={s} />
          <BlockDetail s={s} />
        </div>
        <aside className="right card">
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.id} role="tab" aria-selected={s.tab === t.id} className={s.tab === t.id ? 'active' : ''} onClick={() => store.setTab(t.id)}>
                {t.label}
                {t.id === 'alerts' && s.alerts.length > 0 && <span className="count">{s.alerts.length}</span>}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {s.tab === 'alerts' && <AlertsPanel s={s} />}
            {s.tab === 'outbreak' && <OutbreakPanel s={s} />}
            {s.tab === 'share' && <SharePanel s={s} />}
            {s.tab === 'mesh' && <MeshPanel s={s} />}
            {s.tab === 'family' && <FamilyPanel s={s} />}
          </div>
        </aside>
      </main>

      <footer>
        All data is simulated. Sensors, other devices and the radio link are simulated; signing, gossip, trust and the three engines are real code.
      </footer>
    </div>
  )
}
