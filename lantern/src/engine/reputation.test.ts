import { describe, expect, it } from 'vitest'
import type { Report, Telemetry } from '../types'
import { makeBlocks, simulateTick, RESIDENT_DEVICES_PER_BLOCK } from '../sim/world'
import type { Dataset } from './dataset'
import { computeTruth, TRUST_THRESHOLD } from './trust'
import { computeReputation, NEWCOMER_CAP, NEWCOMER_WEIGHT, TREE_CAP, TRUSTED_MIN, VOUCH_BUDGET } from './reputation'

const blocks = makeBlocks()
const members = new Set(blocks.flatMap((b) => Array.from({ length: RESIDENT_DEVICES_PER_BLOCK }, (_, i) => `${b.id}-r${i}`)))

function run(untilTick: number): Dataset {
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
  return { blocks, telemetry, reports, now: untilTick, trustOn: true }
}

const flood = (ds: Dataset, keys: string[], perKey = 2, blockId = 'L2-B2') => {
  for (const k of keys) for (let i = 0; i < perKey; i++) ds.reports.push({ id: `${k}-${i}`, blockId, type: 'outage', ts: ds.now, deviceKey: k })
}

describe('Sybil resistance', () => {
  it('50 fresh keys flooding a healthy block cannot flip it', () => {
    const ds = run(30)
    const sybils = Array.from({ length: 50 }, (_, i) => `sybil-${i}`)
    flood(ds, sybils)
    ds.rep = computeReputation({ established: members, vouches: [], agreeHours: new Map() })
    const ev = computeTruth(ds).get('L2-B2')!.evidence.power
    expect(ev.newcomers).toBe(50)
    expect(ev.newcomerWeight).toBe(NEWCOMER_CAP)
    expect(ev.flagged).toBe(false)
  })

  it('newcomers vouching for each other gain nothing (colluding ring)', () => {
    const ring = Array.from({ length: 20 }, (_, i) => `ring-${i}`)
    const vouches = ring.flatMap((a, i) => ring.filter((_, j) => j !== i).map((b) => ({ from: a, to: b, ts: i })))
    const rep = computeReputation({ established: members, vouches, agreeHours: new Map() })
    for (const k of ring) expect(rep.get(k)?.weight ?? NEWCOMER_WEIGHT).toBe(NEWCOMER_WEIGHT)
  })

  it('one corrupted member can vouch for at most 3 keys, which cannot vouch further', () => {
    const corrupt = 'L2-B2-r0'
    const army = Array.from({ length: 30 }, (_, i) => `army-${i}`)
    const vouches = [
      ...army.map((a, i) => ({ from: corrupt, to: a, ts: i })),
      ...army.slice(0, 3).flatMap((a, i) => army.slice(3).map((b) => ({ from: a, to: b, ts: 100 + i }))),
    ]
    const rep = computeReputation({ established: members, vouches, agreeHours: new Map() })
    const trusted = army.filter((k) => (rep.get(k)?.weight ?? 0) >= TRUSTED_MIN)
    expect(trusted).toHaveLength(VOUCH_BUDGET)

    // The corrupt member and their whole army report together: still not enough to flip the block.
    const ds = run(30)
    flood(ds, [corrupt, ...army])
    ds.rep = rep
    const ev = computeTruth(ds).get('L2-B2')!.evidence.power
    expect(ev.trustedWeight).toBe(TREE_CAP)
    expect(ev.weight).toBeLessThan(TRUST_THRESHOLD)
  })

  it('three independent residents still flag a real problem', () => {
    const ds = run(30)
    flood(ds, ['L2-B1-r0', 'L2-B3-r1', 'L1-B2-r2'], 1)
    ds.rep = computeReputation({ established: members, vouches: [], agreeHours: new Map() })
    expect(computeTruth(ds).get('L2-B2')!.evidence.power.flagged).toBe(true)
  })

  it('a device vouched for in person counts like a resident', () => {
    const rep = computeReputation({ established: members, vouches: [{ from: 'L4-B1-r0', to: 'phone-1', ts: 1 }], agreeHours: new Map() })
    expect(rep.get('phone-1')).toMatchObject({ status: 'vouched', weight: TRUSTED_MIN })
  })

  it('trust can be earned slowly by agreeing with sensors for many hours', () => {
    const quick = computeReputation({ established: new Set(), vouches: [], agreeHours: new Map([['k', 2]]) })
    const slow = computeReputation({ established: new Set(), vouches: [], agreeHours: new Map([['k', 10]]) })
    expect(quick.get('k')!.status).toBe('newcomer')
    expect(slow.get('k')!.status).toBe('earned')
  })

  it('real blackouts still flag with reputation on', () => {
    const ds = run(85)
    ds.rep = computeReputation({ established: members, vouches: [], agreeHours: new Map() })
    expect(computeTruth(ds).get('L9-B1')!.flaggedKinds).toContain('power')
  })
})
