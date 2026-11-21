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
  /** Problems from the brief this beat answers (lights the strip). */
  problems?: number[]
  run?: () => void | Promise<void>
  /** Actions part-way through the step: [seconds after the step starts, action]. */
  later?: [number, () => void | Promise<void>][]
}

const STEPS: Step[] = [
  {
    title: 'Two views of the same Hollow',
    caption: 'Left: what the Directorate publishes. Right: what residents and sensors report, signed and cross-checked. A family lives in Level 9, Block 2.',
    tab: 'alerts',
    seconds: 7,
    targetTick: 14,
    select: 'L9-B2',
  },
  {
    title: 'The numbers do not match',
    caption: 'Symptom reports on Level 10 jump above each block\'s own normal. Lantern flags a cluster and estimates far more cases than the bulletin admits.',
    tab: 'outbreak',
    seconds: 14,
    targetTick: 50,
    select: 'L10-B2',
    problems: [9],
  },
  {
    title: 'Warnings before the lights go out',
    caption: 'Trends in power, water, heat and air fire warnings with minutes to spare, each saying why. Bad water on Level 11 is caught before it crosses the safe line.',
    tab: 'alerts',
    seconds: 12,
    targetTick: 66,
    select: 'L11-B2',
    problems: [1, 4],
  },
  {
    title: 'Heat you can measure',
    caption: 'Heat plus humidity (wet-bulb) shows where bodies can no longer cool themselves. Spare fan power goes to the most people at most risk.',
    tab: 'heat',
    seconds: 6,
    targetTick: 70,
    select: 'L12-B2',
    problems: [3],
  },
  {
    title: 'The Directorate cuts the network',
    caption: 'The official feed goes dark. Lantern keeps working: signed messages hop device to device, and phones in this room stay connected through the community relay.',
    tab: 'mesh',
    seconds: 9,
    targetTick: 74,
    select: 'L9-B2',
    problems: [7],
    run: () => store.setUplink(false),
  },
  {
    title: 'An attack on the truth',
    caption: '50 brand-new keys flood a healthy block with 100 fake "power out" reports. New keys together count as one stranger. The block holds.',
    tab: 'mesh',
    seconds: 10,
    targetTick: 76,
    select: 'L2-B2',
    run: () => store.sybilAttack('L2-B2', 50, 2),
  },
  {
    title: 'Without the trust rule',
    caption: 'Same flood, rule switched off: the healthy block turns red. Reputation and independent corroboration are what make the map hard to fake.',
    tab: 'mesh',
    seconds: 6,
    targetTick: 77,
    select: 'L2-B2',
    run: () => store.setTrust(false),
  },
  {
    title: 'Fair shares of scarce power',
    caption: 'Upper levels first leaves the deepest blocks with nothing. Lantern equalises coverage of need, weighted by depth and live hazards. The same rule runs fans, lamps, food and the way up.',
    tab: 'share',
    seconds: 10,
    targetTick: 82,
    problems: [2],
    run: () => store.setTrust(true),
  },
  {
    title: 'A tunnel floods; the route changes',
    caption: 'Sewage backs up on Level 8. Gauges close each segment as it floods and flag the stairs below before they go under. The route to the clinic re-plans live. An SOS two blocks away has nobody answering: one tap says "I\'m on my way", tells everyone it is covered, and routes you there.',
    tab: 'routes',
    seconds: 12,
    targetTick: 104,
    select: 'L8-B2',
    problems: [5],
    run: () => store.setRouteTarget('clinic'),
    later: [[9.5, () => store.respondTo('L9-B4')]],
  },
  {
    title: 'Care far from a clinic',
    caption: 'A checklist sorts symptoms into self-care, medicine or clinic. Only the outcome is shared. Medicine demand per block feeds the supply split.',
    tab: 'care',
    seconds: 6,
    targetTick: 107,
    problems: [10],
  },
  {
    title: 'Space, shared by rule',
    caption: 'Bed shifts, quiet rooms and cool rooms are offered and matched: most crowded and deepest first, within walking distance.',
    tab: 'space',
    seconds: 4,
    targetTick: 109,
    problems: [6],
  },
  {
    title: 'What darkness does',
    caption: 'Anonymous 3-tap pulses show mood and sleep falling with depth. Scarce lamp hours go where the light deficit is largest.',
    tab: 'light',
    seconds: 4,
    targetTick: 111,
    problems: [11],
  },
  {
    title: 'When the farms cut you off',
    caption: 'Level 7 has lost its deliveries. The shared ledger shows days of food left, proposes transfers between neighbours, and shows what lamp power costs in fans.',
    tab: 'food',
    seconds: 5,
    targetTick: 113,
    select: 'L7-B1',
    problems: [12],
  },
  {
    title: 'Finding family in a blackout',
    caption: 'A parent taps "I\'m OK" with a shared phrase. A sibling on Level 3 already checked in with the same phrase. No account, no name: only a stretched hash and a block.',
    tab: 'family',
    seconds: 10,
    targetTick: 118,
    select: 'L9-B2',
    problems: [8],
    run: async () => {
      store.setPhrase(FAMILY_PHRASE)
      await store.checkIn(FAMILY_PHRASE)
    },
  },
  {
    title: 'Proof of Air',
    caption: 'Probes in the shafts sign 41 days of readings into a hash chain anyone can re-check. Forge one reading to make the air look deadly, and the chain breaks at that exact entry.',
    tab: 'surface',
    seconds: 10,
    targetTick: 120,
    problems: [13],
    later: [[4, () => store.tamper()]],
  },
  {
    title: 'The way up, decided in the open',
    caption: 'The honest record is restored from other devices. Verified evidence picks the first-wave equipment and opens the shafts; the same fairness rule moves the deepest levels up far sooner.',
    tab: 'return',
    seconds: 8,
    targetTick: 122,
    problems: [14, 15],
    run: () => store.restoreProbes(),
  },
  {
    title: 'The truth, shared by the people living it',
    caption: 'All 15 problems, one system: survive today, prove the way home, go back fairly. Nothing here needs a central server, and nothing can be quietly switched off.',
    tab: 'alerts',
    seconds: 6,
    targetTick: 124,
  },
]

export const DEMO_SECONDS = STEPS.reduce((s, x) => s + x.seconds, 0)

/** Each run gets an id; a run stops as soon as a newer run starts or the demo is stopped. */
let runId = 0
let current = 0
let cancelled = false

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function startDemo() {
  const me = ++runId
  current = me
  cancelled = false
  await store.reset()
  if (current !== me) return
  store.setSpeed(1)
  store.setDemo({ active: true, step: 0, steps: STEPS.length, title: '', caption: '' })
  store.play()
  const live = () => !cancelled && current === me
  for (let i = 0; i < STEPS.length && live(); i++) {
    const s = STEPS[i]
    store.setDemo({ step: i + 1, title: s.title, caption: s.caption })
    store.setTab(s.tab)
    if (s.problems) store.light(...s.problems)
    if (s.select) store.select(s.select)
    await s.run?.()
    const remaining = Math.max(0, s.targetTick - store.getSnapshot().tick)
    store.setSpeed(Math.max(0.2, remaining / s.seconds))
    const startedAt = Date.now()
    const end = startedAt + s.seconds * 1000
    const pending = [...(s.later ?? [])]
    while (Date.now() < end && live()) {
      while (pending.length && Date.now() - startedAt >= pending[0][0] * 1000) await pending.shift()![1]()
      await sleep(100)
    }
  }
  if (current === me) stopDemo()
}

export function stopDemo() {
  cancelled = true
  current = 0
  store.pause()
  store.setDemo({ active: false, step: 0, title: '', caption: '' })
}
