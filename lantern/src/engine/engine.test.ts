import { describe, expect, it } from 'vitest'
import type { Report, Telemetry } from '../types'
import { makeBlocks, simulateTick } from '../sim/world'
import type { Dataset } from './dataset'
import { computeAlerts } from './warning'
import { computeTruth } from './trust'
import { computeOutbreak, distribute } from './outbreak'
import { computeAllocation, maxMinFair, priorityFill } from './allocation'

const blocks = makeBlocks()

function run(untilTick: number, trustOn = true): Dataset {
  const telemetry = new Map<string, Telemetry[]>()
  const reports: Report[] = []
  let n = 0
  for (let t = 1; t <= untilTick; t++) {
    const out = simulateTick(7, t, blocks)
    for (const s of out.telemetry) {
      const list = telemetry.get(s.blockId) ?? []
      list.push({ ...s, deviceKey: `sensor-${s.blockId}` })
      telemetry.set(s.blockId, list)
    }
    for (const r of out.reports) reports.push({ id: String(n++), blockId: r.blockId, type: r.type, ts: r.ts, deviceKey: `${r.blockId}-r${r.slot}` })
  }
  return { blocks, telemetry, reports, now: untilTick, trustOn }
}

describe('scripted story', () => {
  it('stays quiet before anything happens', () => {
    const ds = run(15)
    expect(computeAlerts(ds)).toHaveLength(0)
    expect(computeOutbreak(ds).clusters).toHaveLength(0)
  })

  it('warns about the Level 9 blackout before power crosses the critical line', () => {
    const early = run(70)
    const power = computeAlerts(early).filter((a) => a.kind === 'power' && a.blockId.startsWith('L9-'))
    expect(power.length).toBeGreaterThan(0)
    expect(power.some((a) => a.level === 'warning' && a.etaMinutes > 0)).toBe(true)
  })

  it('warns about the Level 11 water event before it crosses 600 ppm', () => {
    const ds = run(49)
    const w = computeAlerts(ds).find((a) => a.blockId === 'L11-B2' && a.kind === 'water')
    expect(w).toBeDefined()
    expect(w!.level).toBe('warning')
  })

  it('finds the Level 10 outbreak cluster and estimates far more cases than the Directorate reports', () => {
    const ds = run(60)
    const ob = computeOutbreak(ds)
    expect(ob.clusters.length).toBeGreaterThan(0)
    expect(ob.clusters[0].blocks.every((id) => id.startsWith('L10-'))).toBe(true)
    expect(ob.estimatedCases).toBeGreaterThan(200)
  })

  it('flags no healthy block as an outbreak', () => {
    const ob = computeOutbreak(run(60))
    const flagged = [...ob.blocks.values()].filter((b) => b.flagged).map((b) => b.blockId)
    expect(flagged.every((id) => id.startsWith('L10-'))).toBe(true)
  })
})

describe('trust rule', () => {
  const spam = (ds: Dataset) => {
    for (let i = 0; i < 100; i++) ds.reports.push({ id: `spam-${i}`, blockId: 'L2-B2', type: 'outage', ts: ds.now, deviceKey: 'attacker' })
  }

  it('ignores a single device flooding reports', () => {
    const ds = run(30, true)
    spam(ds)
    const truth = computeTruth(ds).get('L2-B2')!
    expect(truth.flaggedKinds).toHaveLength(0)
    expect(truth.rejected).toBeGreaterThanOrEqual(99)
  })

  it('is fooled by the same flood when the rule is off', () => {
    const ds = run(30, false)
    spam(ds)
    expect(computeTruth(ds).get('L2-B2')!.flaggedKinds).toContain('power')
  })

  it('still flags a real blackout from sensor evidence', () => {
    const truth = computeTruth(run(85)).get('L9-B1')!
    expect(truth.flaggedKinds).toContain('power')
  })
})

describe('allocation', () => {
  it('gives every block the same coverage under max-min fairness', () => {
    const needs = [100, 300, 600]
    const out = maxMinFair(needs, 500)
    expect(out.map((x, i) => x / needs[i])).toEqual([0.5, 0.5, 0.5])
  })

  it('upper-first starves the deepest levels while fair does not', () => {
    const a = computeAllocation(blocks, 'power', 0.55, () => 0)
    expect(a.official.minCoverage).toBe(0)
    expect(a.fair.minCoverage).toBeCloseTo(0.55, 5)
    expect(a.fair.gini).toBeLessThan(a.official.gini)
    expect(a.fair.peopleBelowHalf).toBeLessThan(a.official.peopleBelowHalf)
  })

  it('never allocates more than the supply', () => {
    const needs = blocks.map((b) => b.population * b.hardship)
    const supply = needs.reduce((s, n) => s + n, 0) * 0.4
    expect(priorityFill(blocks, needs, supply).reduce((s, n) => s + n, 0)).toBeCloseTo(supply, 3)
    expect(maxMinFair(needs, supply).reduce((s, n) => s + n, 0)).toBeCloseTo(supply, 3)
  })

  it('distributes supplies without losing units', () => {
    const out = distribute(1000, [3, 3, 1])
    expect(out.reduce((s, n) => s + n, 0)).toBe(1000)
  })
})
