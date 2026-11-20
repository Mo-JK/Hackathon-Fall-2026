import { store } from './store'
import type { TabId } from './store'
import { FAMILY_PHRASE } from './sim/world'

interface Step {
  title: string
  caption: string
  tab: TabId
  /** Real seconds this step lasts. */
  seconds: number
  /** Simulation tick to reach by the end of the step. */
  targetTick: number
  select?: string
  run?: () => void | Promise<void>
}

const STEPS: Step[] = [
  {
    title: 'Level 9, Block 2',
    caption: 'A family lives here. The Directorate says: "All systems normal." Lantern shows what residents and sensors actually report.',
    tab: 'alerts',
    seconds: 7,
    targetTick: 14,
    select: 'L9-B2',
  },
  {
    title: 'The numbers do not match',
    caption: 'Residents report symptoms on Level 10. Lantern flags a cluster and estimates far more cases than the official bulletin admits.',
    tab: 'outbreak',
    seconds: 22,
    targetTick: 50,
    select: 'L10-B2',
  },
  {
    title: 'Warnings before the lights go out',
    caption: 'Trends in power, water, heat and air fire early warnings, each one explaining why. Bad water is caught on Level 11 before it crosses the line.',
    tab: 'alerts',
    seconds: 22,
    targetTick: 70,
    select: 'L11-B2',
  },
  {
    title: 'The Directorate cuts the network',
    caption: 'The official feed goes dark. Lantern keeps working: signed messages gossip peer to peer and the maps stay current.',
    tab: 'mesh',
    seconds: 14,
    targetTick: 80,
    select: 'L9-B2',
    run: () => store.setUplink(false),
  },
  {
    title: 'An attack on the truth',
    caption: 'One device floods 100 fake outage reports into a healthy block. The trust rule counts it once, so the map does not move.',
    tab: 'mesh',
    seconds: 14,
    targetTick: 84,
    select: 'L2-B2',
    run: () => store.spamAttack('L2-B2', 100),
  },
  {
    title: 'Without the trust rule',
    caption: 'Same flood, rule switched off: the healthy block turns red. Corroboration from independent devices is what makes the map hard to fake.',
    tab: 'mesh',
    seconds: 8,
    targetTick: 86,
    select: 'L2-B2',
    run: () => store.setTrust(false),
  },
  {
    title: 'Fair shares of scarce power',
    caption: 'Today the upper levels are served first and the deep levels go dark. Equalising coverage of need, weighted by depth and live hazards, serves everyone.',
    tab: 'share',
    seconds: 20,
    targetTick: 100,
    run: () => store.setTrust(true),
  },
  {
    title: 'Finding family in a blackout',
    caption: 'A parent taps "I\'m OK" with a shared phrase. A sibling on Level 3 searches the same phrase and sees them. No account, only block-level location.',
    tab: 'family',
    seconds: 22,
    targetTick: 112,
    select: 'L9-B2',
    run: async () => {
      store.setPhrase(FAMILY_PHRASE)
      await store.checkIn(FAMILY_PHRASE)
    },
  },
  {
    title: 'The truth, shared by the people living it',
    caption: 'Early warnings, an honest outbreak count, fair shares and family check-ins, all running with no central server to switch off.',
    tab: 'alerts',
    seconds: 6,
    targetTick: 120,
  },
]

let cancelled = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function startDemo() {
  cancelled = false
  await store.reset()
  store.setSpeed(1)
  store.setDemo({ active: true, step: 0, steps: STEPS.length, title: '', caption: '' })
  store.play()
  for (let i = 0; i < STEPS.length && !cancelled; i++) {
    const s = STEPS[i]
    store.setDemo({ step: i + 1, title: s.title, caption: s.caption })
    store.setTab(s.tab)
    if (s.select) store.select(s.select)
    await s.run?.()
    const remaining = Math.max(0, s.targetTick - store.getSnapshot().tick)
    store.setSpeed(Math.max(0.2, remaining / s.seconds))
    const end = Date.now() + s.seconds * 1000
    while (Date.now() < end && !cancelled) await sleep(100)
  }
  stopDemo()
}

export function stopDemo() {
  cancelled = true
  store.pause()
  store.setDemo({ active: false, step: 0, title: '', caption: '' })
}
