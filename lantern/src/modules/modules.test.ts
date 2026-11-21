import { describe, expect, it } from 'vitest'
import type { MsgData, ProbeData, Rec, RecOf } from '../types'
import { makeBlocks, simulateTick, TOTAL_TICKS } from '../sim/world'
import { CLINICS, edgeId, makeEdges, probeHistory, SHAFTS, volunteers } from '../sim/hollow'
import { newIdentity, signBody } from '../mesh/crypto'
import { coolRefuges, heatRows, riskOf, scheduleFans, wetBulb } from './heat'
import { floodState, hops, routeTo } from './routes'
import type { Hazards } from './routes'
import { crowding, matchSpace, MAX_HOPS } from './space'
import { careTable, NO_SYMPTOMS, triage } from './care'
import { K_ANON } from './privacy'
import { depthCorrelation, lampRota, pulseByLevel } from './light'
import { balanceDistrict, daysLeft, foodTable, ledgers } from './food'
import type { ProbeMsg } from './surface'
import { assess, entryHash, rankCohort, SAFE_DAYS_TO_OPEN, shaftOpen, surfaceOptions, verifyChain } from './surface'
import { maxFlow, planReturn } from './returnplan'

const blocks = makeBlocks()
const edges = makeEdges()
const none: Hazards = { closed: new Set(), blockCost: new Map() }

let n = 0
function rec<D extends MsgData>(blockId: string, data: D, deviceKey = `dev-${n}`, ts = 1): Rec<D> {
  return { id: `r${n++}`, blockId, ts, wall: 0, deviceKey, pub: deviceKey, mine: false, virtual: true, data }
}

/** Run the simulator and collect module traffic as records (unsigned: these tests are about the engines). */
function simRecs(until: number) {
  const out = { gauge: [] as RecOf<'gauge'>[], pulse: [] as RecOf<'pulse'>[], triage: [] as RecOf<'triage'>[], space: [] as RecOf<'space'>[], plot: [] as RecOf<'plot'>[], latest: new Map<string, { temp: number; rh: number; water: number }>() }
  for (let t = 1; t <= until; t++) {
    const s = simulateTick(7, t, blocks)
    for (const x of s.telemetry) out.latest.set(x.blockId, x)
    const m = s.mod
    for (const g of m.gauges) out.gauge.push(rec(g.edge.split('|')[0], { k: 'gauge', edge: g.edge, depth: g.depth }, `gauge-${g.edge}`, t))
    for (const p of m.pulses) out.pulse.push(rec(p.blockId, { k: 'pulse', sleep: p.sleep, mood: p.mood, light: p.light }, `${p.blockId}-r${p.slot}`, t))
    for (const x of m.triages) out.triage.push(rec(x.blockId, { k: 'triage', outcome: x.outcome }, `${x.blockId}-r${x.slot}`, t))
    for (const x of m.spaces) out.space.push(rec(x.blockId, { k: 'space', mode: x.mode, what: x.what, slots: x.slots }, `${x.blockId}-r${x.slot}`, t))
    for (const x of m.plots) out.plot.push(rec(x.blockId, { k: 'plot', crop: x.crop, kg: x.kg, ready: x.ready }, `${x.blockId}-r${x.slot}`, t))
  }
  return out
}

describe('heat (problem 3)', () => {
  it('matches Stull\'s published wet-bulb example (20 °C, 50% RH ≈ 13.7 °C)', () => {
    expect(wetBulb(20, 50)).toBeCloseTo(13.7, 1)
  })

  it('the Level 12 heat wave becomes dangerous while upper levels stay safe', () => {
    const r = simRecs(60)
    const rows = heatRows(blocks, r.latest)
    expect(rows.find((x) => x.blockId === 'L12-B1')!.risk).not.toBe('ok')
    expect(rows.find((x) => x.blockId === 'L1-B1')!.risk).toBe('ok')
    expect(riskOf(36)).toBe('extreme')
  })

  it('fan power is split by heat risk x people and never exceeds the budget', () => {
    const rows = heatRows(blocks, simRecs(100).latest)
    const fans = scheduleFans(rows, 0.4)
    const need = fans.reduce((s, f) => s + f.need, 0)
    expect(fans.reduce((s, f) => s + f.alloc, 0)).toBeCloseTo(need * 0.4, 3)
    for (const f of fans) expect(f.coverage).toBeCloseTo(0.4, 5)
  })

  it('cool refuges are cool and powered', () => {
    const rows = heatRows(blocks, simRecs(100).latest)
    const ref = coolRefuges(rows, (id) => !id.startsWith('L1-'))
    expect(ref.length).toBeGreaterThan(0)
    expect(ref.some((id) => id.startsWith('L1-'))).toBe(false)
  })
})

describe('routes and floods (problems 5, 8, 10)', () => {
  it('finds a route and avoids a closed segment', () => {
    const r1 = routeTo(edges, 'L9-B2', ['L8-B2'], none)!
    expect(r1.path).toEqual(['L9-B2', 'L8-B2'])
    const r2 = routeTo(edges, 'L9-B2', ['L8-B2'], { closed: new Set([edgeId('L8-B2', 'L9-B2')]), blockCost: new Map() })!
    expect(r2.path.length).toBeGreaterThan(2)
    expect(r2.path).not.toEqual(['L9-B2', 'L8-B2'])
  })

  it('returns null when every way is shut', () => {
    const closed = new Set(edges.filter((e) => e.a === 'L1-B1' || e.b === 'L1-B1').map((e) => e.id))
    expect(routeTo(edges, 'L1-B1', ['L5-B3'], { closed, blockCost: new Map() })).toBeNull()
  })

  it('the Level 8 flood closes segments in order and the clinic route from Level 9 re-plans', () => {
    const before = floodState(simRecs(86).gauge, edges)
    expect(before.closed.size).toBe(0)
    const after = floodState(simRecs(100).gauge, edges)
    expect(after.closed.has('L8-B1|L8-B2')).toBe(true)
    expect(after.closed.has('L8-B2|L9-B2')).toBe(true)
    const r0 = routeTo(edges, 'L9-B2', CLINICS, { closed: before.closed, blockCost: new Map() })!
    const r1 = routeTo(edges, 'L9-B2', CLINICS, { closed: after.closed, blockCost: new Map() })!
    expect(r1.path).not.toEqual(r0.path)
    for (let i = 1; i < r1.path.length; i++) expect(after.closed.has(edgeId(r1.path[i - 1], r1.path[i]))).toBe(false)
  })

  it('flags the stairs below a flooded segment as at risk before they go under', () => {
    const mid = floodState(simRecs(92).gauge, edges)
    expect(mid.closed.has('L8-B1|L8-B2')).toBe(true)
    expect(mid.atRisk.has('L8-B2|L9-B2')).toBe(true)
    expect(mid.closed.has('L8-B2|L9-B2')).toBe(false)
  })

  it('re-plans away from stairs that are about to flood, before they close', () => {
    const mid = floodState(simRecs(92).gauge, edges)
    const plain = routeTo(edges, 'L9-B2', CLINICS, { closed: mid.closed, blockCost: new Map() })!
    const careful = routeTo(edges, 'L9-B2', CLINICS, { closed: mid.closed, blockCost: new Map(), edgeCost: new Map([...mid.atRisk].map((e) => [e, 4])) })!
    expect(plain.path.slice(0, 2)).toEqual(['L9-B2', 'L8-B2'])
    expect(careful.path.slice(0, 2)).not.toEqual(['L9-B2', 'L8-B2'])
  })
})

describe('space (problem 6)', () => {
  it('deeper levels are more crowded', () => {
    const c = crowding(blocks)
    expect(c.find((x) => x.blockId === 'L12-B1')!.perRoom).toBeGreaterThan(c.find((x) => x.blockId === 'L1-B1')!.perRoom)
  })

  it('serves the most crowded request first, within walking distance, never over-allocating', () => {
    const offers = [rec('L8-B1', { k: 'space', mode: 'offer', what: 'sleep', slots: 2 })]
    const requests = [rec('L6-B1', { k: 'space', mode: 'request', what: 'sleep', slots: 2 }), rec('L9-B1', { k: 'space', mode: 'request', what: 'sleep', slots: 2 }), rec('L1-B1', { k: 'space', mode: 'request', what: 'sleep', slots: 1 })]
    const res = matchSpace(offers, requests, blocks, edges, () => false)
    expect(res.matches[0].to).toBe('L9-B1')
    expect(res.served).toBe(2)
    expect(res.matches.every((m) => m.hops <= MAX_HOPS)).toBe(true)
    expect(res.matches.some((m) => m.to === 'L1-B1')).toBe(false)
    expect(hops(edges, 'L1-B1').get('L8-B1')).toBeGreaterThan(MAX_HOPS)
  })
})

describe('care (problems 9, 10)', () => {
  it('sends danger signs to a clinic, lasting fever + cough to medicine, the rest to self-care', () => {
    expect(triage({ ...NO_SYMPTOMS, cough: true, breathlessAtRest: true }).outcome).toBe('clinic')
    expect(triage({ ...NO_SYMPTOMS, cough: true, fever: true, days: 4 }).outcome).toBe('medicine')
    expect(triage({ ...NO_SYMPTOMS, cough: true, fever: true, days: 1, over65: true }).outcome).toBe('medicine')
    expect(triage({ ...NO_SYMPTOMS, cough: true, days: 1 }).outcome).toBe('self')
  })

  it(`hides a block's outcomes until ${K_ANON} different devices have reported`, () => {
    const few = [0, 1, 2].map((i) => rec('L3-B1', { k: 'triage', outcome: 'medicine' as const }, `d${i}`))
    const many = [0, 1, 2, 3, 4, 5].map((i) => rec('L4-B1', { k: 'triage', outcome: 'medicine' as const }, `e${i}`))
    const rows = careTable([...few, ...many], blocks)
    expect(rows.find((r) => r.blockId === 'L3-B1')!.hidden).toBe(true)
    expect(rows.find((r) => r.blockId === 'L4-B1')!.hidden).toBe(false)
  })

  it('outbreak triage concentrates on Level 10', () => {
    const rows = careTable(simRecs(70).triage, blocks).filter((r) => !r.hidden)
    const top = rows.sort((a, b) => b.medicine - a.medicine)[0]
    expect(top.blockId.startsWith('L10-')).toBe(true)
  })
})

describe('light and body (problem 11)', () => {
  const levels = Array.from({ length: 12 }, (_, i) => i + 1)
  it('mood and daylight fall with depth', () => {
    const rows = pulseByLevel(simRecs(TOTAL_TICKS).pulse, levels)
    expect(depthCorrelation(rows, 'mood')).toBeLessThan(-0.7)
    expect(depthCorrelation(rows, 'light')).toBeLessThan(-0.9)
  })

  it('lamp hours go to the darkest levels and never exceed the budget', () => {
    const rows = pulseByLevel(simRecs(TOTAL_TICKS).pulse, levels)
    const rota = lampRota(blocks, rows, 150)
    expect(rota.reduce((s, r) => s + r.hours, 0)).toBeLessThanOrEqual(150.0001)
    const l12 = rota.find((r) => r.level === 12)!.hours
    const l1 = rota.find((r) => r.level === 1)?.hours ?? 0
    expect(l12).toBeGreaterThan(l1)
  })
})

describe('food (problem 12)', () => {
  it('counts pantry days and adds harvests on the day they ripen', () => {
    expect(daysLeft(1000, { pantry: 600 * 3, plots: [] }, 0)).toBeCloseTo(3, 5)
    expect(daysLeft(1000, { pantry: 600 * 3, plots: [{ crop: 'kale', kg: 1200, ready: 144 * 2 }] }, 0)).toBeCloseTo(5, 5)
  })

  it('district sharing moves food without losing any and lifts the worst block', () => {
    const rows = foodTable(blocks, ledgers(simRecs(10).plot), 10)
    const { transfers, before, after } = balanceDistrict(rows, 7)
    expect(transfers.length).toBeGreaterThan(0)
    expect(after).toBeGreaterThan(before)
    const moved = transfers.reduce((s, t) => s + t.kg, 0)
    expect(moved).toBeGreaterThan(0)
    expect(transfers.every((t) => t.from !== t.to)).toBe(true)
  })

  it('Level 7 (cut off from the farms) is the worst fed', () => {
    const rows = foodTable(blocks, ledgers(simRecs(10).plot), 10)
    const worst = [...rows].sort((a, b) => a.days - b.days)[0]
    expect(worst.level).toBe(7)
  })
})

describe('Proof of Air (problem 13)', () => {
  async function chain(len = 12): Promise<ProbeMsg[]> {
    const probe = await newIdentity()
    const out: ProbeMsg[] = []
    let prev = ''
    for (let i = 0; i < len; i++) {
      const data: ProbeData = { k: 'probe', probe: 'A', seq: i, day: 1 + Math.floor(i / 4), prev, aqi: 60, o2: 20.6, rad: 0.2, tempC: 12 }
      const m = (await signBody(probe, { id: `p${i}`, blockId: 'L1-B1', ts: 0, wall: 0, data }, 'swarm')) as ProbeMsg
      prev = entryHash(m)
      out.push(m)
    }
    return out
  }

  it('an honest chain verifies end to end', async () => {
    const c = await chain()
    const res = await verifyChain(c)
    expect(res.firstBad).toBe(-1)
    expect(res.ok).toBe(12)
  })

  it('editing one old reading breaks the chain at exactly that entry', async () => {
    const c = await chain()
    c[5] = { ...c[5], data: { ...c[5].data, aqi: 420 } }
    const res = await verifyChain(c)
    expect(res.firstBad).toBe(5)
    expect(res.statuses[5]).toBe('bad-signature')
    expect(res.statuses.slice(6).every((s) => s === 'unverified')).toBe(true)
  })

  it('re-signing a forged reading with another key is also caught', async () => {
    const c = await chain()
    const forger = await newIdentity()
    const registered = c[0].pub
    c[5] = (await signBody(forger, { ...c[5], data: { ...c[5].data, aqi: 420 } }, 'swarm')) as ProbeMsg
    expect((await verifyChain(c, registered)).firstBad).toBe(5)
  })

  it('removing an entry breaks the link', async () => {
    const c = await chain()
    c.splice(4, 1)
    expect((await verifyChain(c)).statuses[4]).toBe('bad-link')
  })

  it('the simulated shafts: A and B improve enough to open, C near the machine yard does not', () => {
    const h = probeHistory(7)
    const a = assess('A', h.filter((r) => r.probe === 'A').map((r) => ({ ...r, k: 'probe' as const, prev: '' })))
    const c = assess('C', h.filter((r) => r.probe === 'C').map((r) => ({ ...r, k: 'probe' as const, prev: '' })))
    expect(a.verdict).toBe('mask')
    expect(a.daysSafe).toBeGreaterThanOrEqual(SAFE_DAYS_TO_OPEN)
    expect(shaftOpen(a, true)).toBe(true)
    expect(shaftOpen(a, false)).toBe(false)
    expect(c.verdict).not.toBe('mask')
  })
})

describe('the way up (problems 14, 15)', () => {
  it('with no trusted evidence nothing is viable; good air puts suits first; worse air rules suits out', () => {
    expect(surfaceOptions(null).every((o) => !o.viable)).toBe(true)
    expect(surfaceOptions(52)[0].id).toBe('suit')
    const poor = surfaceOptions(140)
    expect(poor.find((o) => o.id === 'suit')!.viable).toBe(false)
    expect(poor[0].viable).toBe(true)
  })

  it('never picks a volunteer who did not consent, and covers the required skills', () => {
    const vols = volunteers(7)
    const { picks, declined } = rankCohort(vols)
    expect(declined).toBeGreaterThan(0)
    expect(picks.every((p) => p.volunteer.consent)).toBe(true)
    for (const skill of ['medic', 'engineer']) expect(picks.some((p) => p.volunteer.skills.includes(skill))).toBe(true)
  })

  it('max-flow finds the textbook answer', () => {
    // s=0 → 1 (10), s → 2 (5), 1 → 2 (15), 1 → t=3 (5), 2 → t (10): max flow 15
    const cap = [
      [0, 10, 5, 0],
      [0, 0, 15, 5],
      [0, 0, 0, 10],
      [0, 0, 0, 0],
    ]
    expect(maxFlow(cap, 0, 3).value).toBe(15)
  })

  it('moves everyone it can reach and brings the deepest level up sooner under the fair plan', () => {
    const levels = Array.from({ length: 12 }, (_, i) => {
      const bs = blocks.filter((b) => b.level === i + 1)
      return { level: i + 1, people: bs.reduce((s, b) => s + b.population, 0), hardship: bs[0].hardship }
    })
    const open = SHAFTS.filter((s) => s.id !== 'C')
    const fair = planReturn(levels, open, 'fair')
    const upper = planReturn(levels, open, 'upper')
    for (const l of levels) {
      expect(Number.isFinite(fair.finish.get(l.level)!)).toBe(true)
      expect(Number.isFinite(upper.finish.get(l.level)!)).toBe(true)
    }
    expect(fair.finish.get(12)!).toBeLessThan(upper.finish.get(12)!)
    expect(fair.start.get(12)!).toBeLessThan(upper.start.get(12)!)
    const total = levels.reduce((s, l) => s + l.people, 0)
    const cap = open.reduce((s, x) => s + x.capPerDay, 0)
    expect(fair.days).toBeGreaterThanOrEqual(Math.ceil(total / cap))
  })

  it('a level no open shaft serves is reported as unreachable, not silently dropped', () => {
    const levels = [
      { level: 1, people: 100, hardship: 1 },
      { level: 12, people: 100, hardship: 2 },
    ]
    const plan = planReturn(levels, [SHAFTS[0]], 'fair')
    expect(plan.finish.get(1)).toBe(1)
    expect(plan.finish.get(12)).toBe(Infinity)
  })
})
