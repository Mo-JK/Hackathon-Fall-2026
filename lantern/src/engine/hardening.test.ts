import { describe, expect, it } from 'vitest'
import type { Msg, MsgBody, Report, Telemetry } from '../types'
import { newIdentity, signBody } from '../mesh/crypto'
import { GossipNode } from '../mesh/gossip'
import { validMsg } from '../mesh/validate'
import { makeBlocks, RESIDENT_DEVICES_PER_BLOCK, simulateTick, tempClean, rhClean } from '../sim/world'
import { wetBulb } from '../modules/heat'
import { computeOutbreak } from './outbreak'
import { computeReputation } from './reputation'
import type { Dataset } from './dataset'
import { briefing } from '../modules/briefing'
import type { BriefingInput } from '../modules/briefing'
import { makeEdges } from '../sim/hollow'
import { isStale, LIVE_MS } from '../store'

const blocks = makeBlocks()
const body = (id: string, data: MsgBody['data']): MsgBody => ({ id, blockId: 'L9-B2', ts: 5, wall: 1000, data })

describe('message validation', () => {
  it('accepts well-formed messages and rejects malformed ones before they reach the engines', async () => {
    const id = await newIdentity()
    const good = await signBody(id, body('a', { k: 'report', type: 'outage' }), 'user')
    expect(validMsg(good)).toBe(true)
    expect(validMsg({ ...good, data: { k: 'nonsense' } })).toBe(false)
    expect(validMsg({ ...good, data: { k: 'vouch', target: 42 } })).toBe(false)
    expect(validMsg({ ...good, data: { k: 'pulse', sleep: 1e9, mood: 3, light: 10 } })).toBe(false)
    expect(validMsg({ ...good, blockId: '<script>' })).toBe(false)
    expect(validMsg(null)).toBe(false)
  })

  it('a correctly signed but malformed message is dropped, not applied', async () => {
    const applied: string[] = []
    const node = new GossipNode((m) => applied.push(m.id), () => {})
    const id = await newIdentity()
    const bad = (await signBody(id, body('b', { k: 'unknown' } as unknown as MsgBody['data']), 'user')) as Msg
    expect(await node.ingest(bad)).toBe(false)
    expect(applied).toEqual([])
    expect(node.stats.invalid).toBe(1)
  })

  it('local policy can refuse sensor readings from keys that are not registered sensors', async () => {
    const sensor = await newIdentity()
    const phone = await newIdentity()
    const node = new GossipNode(() => {}, () => {}, undefined, (m) => m.data.k !== 'telemetry' || m.pub === sensor.pub)
    const reading = { k: 'telemetry' as const, power: 0, water: 300, temp: 25, air: 50, rh: 40 }
    expect(await node.ingest(await signBody(sensor, body('s1', reading), 'swarm'))).toBe(true)
    expect(await node.ingest(await signBody(phone, body('s2', reading), 'user'))).toBe(false)
  })

  it('treats old real-device messages as stale, but keeps family check-ins for a day', () => {
    const now = 10 * LIVE_MS
    expect(isStale({ wall: now - 1000, data: { k: 'sos', need: 'medical' } }, now)).toBe(false)
    expect(isStale({ wall: now - LIVE_MS - 1, data: { k: 'sos', need: 'medical' } }, now)).toBe(true)
    expect(isStale({ wall: now - LIVE_MS - 1, data: { k: 'checkin', codeHash: 'ab' } }, now)).toBe(false)
    expect(isStale({ wall: now + 60 * 60_000, data: { k: 'report', type: 'outage' } }, now)).toBe(true)
  })
})

describe('outbreak detection under a Sybil flood', () => {
  it('50 brand-new keys reporting symptoms cannot invent an outbreak', () => {
    const telemetry = new Map<string, Telemetry[]>()
    const reports: Report[] = []
    let n = 0
    for (let t = 1; t <= 40; t++) for (const r of simulateTick(7, t, blocks).reports) reports.push({ id: String(n++), blockId: r.blockId, type: r.type, ts: r.ts, deviceKey: `${r.blockId}-r${r.slot}` })
    for (let k = 0; k < 50; k++) for (let t = 35; t <= 40; t++) reports.push({ id: `s${k}-${t}`, blockId: 'L2-B2', type: 'symptom', ts: t, deviceKey: `sybil-${k}` })
    const members = new Set(blocks.flatMap((b) => Array.from({ length: RESIDENT_DEVICES_PER_BLOCK }, (_, i) => `${b.id}-r${i}`)))
    const ds: Dataset = { blocks, telemetry, reports, now: 40, trustOn: true, rep: computeReputation({ established: members, vouches: [], agreeHours: new Map() }) }
    expect(computeOutbreak(ds).blocks.get('L2-B2')!.flagged).toBe(false)
    expect(computeOutbreak({ ...ds, trustOn: false }).blocks.get('L2-B2')!.flagged).toBe(true)
  })
})

describe('heat model stays physically plausible', () => {
  it('levels off instead of climbing forever, and upper levels stay cool', () => {
    for (const b of blocks) {
      for (const t of [0, 72, 144, 400]) {
        const tw = wetBulb(tempClean(b, t), rhClean(b, t))
        expect(tw).toBeLessThan(39)
        if (b.level <= 4) expect(tw).toBeLessThan(28)
      }
    }
  })
})

describe('your-block briefing', () => {
  const base: BriefingInput = {
    home: 'L9-B2',
    edges: makeEdges(),
    flagged: () => [],
    outbreakFlagged: () => false,
    alerts: [],
    heat: [],
    coolRoute: null,
    waterRoute: null,
    flood: { depth: new Map(), closed: new Set(), atRisk: new Set() },
    sos: [],
    responders: new Map(),
    helping: null,
    family: null,
  }

  it('says all clear when nothing is wrong', () => {
    const b = briefing(base)
    expect(b.level).toBe('ok')
    expect(b.items).toHaveLength(1)
  })

  it('puts confirmed hazards and an unanswered SOS nearby first, with an action to answer it', () => {
    const sos = { id: 's1', blockId: 'L9-B4', ts: 3, wall: 0, deviceKey: 'x', pub: 'x', mine: false, virtual: true, data: { k: 'sos' as const, need: 'medical' as const } }
    const b = briefing({ ...base, flagged: (id) => (id === 'L9-B2' ? ['power'] : []), sos: [sos], family: { blockId: 'L3-B2', minutesAgo: 4 } })
    expect(b.level).toBe('act')
    expect(b.items[0].text).toContain('power is out')
    expect(b.items.find((i) => i.action?.respond === 'L9-B4')).toBeTruthy()
    expect(b.items[b.items.length - 1].tone).toBe('good')
  })

  it('stops asking for help once someone is on the way', () => {
    const sos = { id: 's1', blockId: 'L9-B3', ts: 3, wall: 0, deviceKey: 'x', pub: 'x', mine: false, virtual: true, data: { k: 'sos' as const, need: 'trapped' as const } }
    const b = briefing({ ...base, sos: [sos], responders: new Map([['s1', 2]]) })
    expect(b.items.some((i) => i.action?.respond)).toBe(false)
    expect(b.items[0].text).toContain('2 people are on the way')
  })
})
