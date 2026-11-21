import type { Block, Msg, MsgBody, MsgData } from '../types'
import { RESIDENT_DEVICES_PER_BLOCK } from '../sim/world'
import type { SimOutput } from '../sim/world'
import { GAUGED_EDGES, PROBES } from '../sim/hollow'
import type { ProbeReading } from '../sim/hollow'
import type { ProbeMsg } from '../modules/surface'
import { entryHash } from '../modules/surface'
import type { Identity } from './crypto'
import { newIdentity, phraseHash, signBody } from './crypto'

/**
 * The simulated population of other devices in the mesh. Each sensor, gauge, probe and
 * resident device has its own keypair and signs what it sends, exactly as a real device would.
 * The radio link is the only simulated part.
 */
export class Swarm {
  private sensors = new Map<string, Identity>()
  private gauges = new Map<string, Identity>()
  private probes = new Map<string, Identity>()
  private residents = new Map<string, Identity[]>()
  private counter = 0
  private constructor(private attacker: Identity) {}

  static async create(blocks: Block[]): Promise<Swarm> {
    const swarm = new Swarm(await newIdentity())
    await Promise.all([
      ...blocks.map(async (b) => {
        if (b.hasSensor) swarm.sensors.set(b.id, await newIdentity())
        swarm.residents.set(b.id, await Promise.all(Array.from({ length: RESIDENT_DEVICES_PER_BLOCK }, () => newIdentity())))
      }),
      ...GAUGED_EDGES.map(async (e) => swarm.gauges.set(e, await newIdentity())),
      ...PROBES.map(async (p) => swarm.probes.set(p.id, await newIdentity())),
    ])
    return swarm
  }

  /** Device keys of the community's existing members (known before the simulated day starts). */
  memberKeys(): string[] {
    return [...this.residents.values()].flat().map((i) => i.deviceKey)
  }

  /**
   * Public keys of installed sensors, flood gauges and surface probes. In the field these are
   * published when a device is installed and sealed; a reading signed by any other key is not
   * sensor evidence, however well formed it is.
   */
  sensorKeys(): Set<string> {
    return new Set([...this.sensors.values(), ...this.gauges.values(), ...this.probes.values()].map((i) => i.pub))
  }

  private id(prefix: string) {
    return `${prefix}-${++this.counter}`
  }

  /** Hops grow with distance from the user's own level: deep devices are further away. */
  private hopsFor(blockId: string, homeLevel: number) {
    const level = Number(blockId.slice(1, blockId.indexOf('-')))
    return Math.min(12, 1 + Math.abs(level - homeLevel))
  }

  private async make(who: Identity, body: MsgBody, hops: number): Promise<Msg> {
    const m = await signBody(who, body, 'swarm')
    return { ...m, hops, ttl: 16 - hops }
  }

  async messagesFor(out: SimOutput, homeLevel: number, wall: number): Promise<Msg[]> {
    const jobs: Promise<Msg>[] = []
    const send = (who: Identity, prefix: string, blockId: string, data: MsgData) =>
      jobs.push(this.make(who, { id: this.id(prefix), blockId, ts: out.tick, wall, data }, this.hopsFor(blockId, homeLevel)))
    const resident = (blockId: string, slot: number) => this.residents.get(blockId)![slot % RESIDENT_DEVICES_PER_BLOCK]

    for (const t of out.telemetry) {
      send(this.sensors.get(t.blockId)!, 't', t.blockId, { k: 'telemetry', power: t.power, water: t.water, temp: t.temp, air: t.air, rh: t.rh })
    }
    for (const r of out.reports) send(resident(r.blockId, r.slot), 'r', r.blockId, { k: 'report', type: r.type })
    for (const c of out.checkins) send(resident(c.blockId, 0), 'c', c.blockId, { k: 'checkin', codeHash: await phraseHash(c.phrase) })

    const m = out.mod
    for (const g of m.gauges) send(this.gauges.get(g.edge)!, 'g', g.edge.split('|')[0], { k: 'gauge', edge: g.edge, depth: g.depth })
    for (const p of m.pulses) send(resident(p.blockId, p.slot), 'p', p.blockId, { k: 'pulse', sleep: p.sleep, mood: p.mood, light: p.light })
    for (const t of m.triages) send(resident(t.blockId, t.slot), 'tr', t.blockId, { k: 'triage', outcome: t.outcome })
    for (const s of m.spaces) send(resident(s.blockId, s.slot), 's', s.blockId, { k: 'space', mode: s.mode, what: s.what, slots: s.slots })
    for (const p of m.plots) send(resident(p.blockId, p.slot), 'f', p.blockId, { k: 'plot', crop: p.crop, kg: p.kg, ready: p.ready })
    for (const s of m.sos) send(resident(s.blockId, s.slot), 'sos', s.blockId, { k: 'sos', need: s.need })
    for (const r of m.responds) send(resident(r.blockId, r.slot), 'ack', r.blockId, { k: 'respond', to: r.to })
    return Promise.all(jobs)
  }

  /** One device floods a healthy block with fake outage reports. */
  async spam(blockId: string, n: number, tick: number, wall: number, homeLevel: number): Promise<Msg[]> {
    return Promise.all(
      Array.from({ length: n }, () =>
        this.make(this.attacker, { id: this.id('x'), blockId, ts: tick, wall, data: { k: 'report', type: 'outage' } }, this.hopsFor(blockId, homeLevel)),
      ),
    )
  }

  /** A Sybil attack: `keys` brand-new identities, each sending `perKey` fake outage reports. */
  async sybil(blockId: string, keys: number, perKey: number, tick: number, wall: number, homeLevel: number): Promise<Msg[]> {
    const ids = await Promise.all(Array.from({ length: keys }, () => newIdentity()))
    const jobs: Promise<Msg>[] = []
    for (const who of ids) {
      for (let i = 0; i < perKey; i++) {
        jobs.push(this.make(who, { id: this.id('sy'), blockId, ts: tick, wall, data: { k: 'report', type: 'outage' } }, this.hopsFor(blockId, homeLevel)))
      }
    }
    return Promise.all(jobs)
  }

  /** Each probe signs its readings in order, each entry carrying the hash of the one before. */
  async probeChain(readings: ProbeReading[], wall: number): Promise<ProbeMsg[]> {
    const out: ProbeMsg[] = []
    for (const p of PROBES) {
      const who = this.probes.get(p.id)!
      let prev = ''
      for (const r of readings.filter((x) => x.probe === p.id).sort((a, b) => a.seq - b.seq)) {
        const data = { k: 'probe' as const, probe: r.probe, seq: r.seq, day: r.day, prev, aqi: r.aqi, o2: r.o2, rad: r.rad, tempC: r.tempC }
        const m = (await signBody(who, { id: `probe-${p.id}-${r.seq}`, blockId: 'L1-B1', ts: 0, wall, data }, 'swarm')) as ProbeMsg
        prev = entryHash(m)
        out.push(m)
      }
    }
    return out
  }

  get deviceCount() {
    return this.sensors.size + this.gauges.size + this.probes.size + [...this.residents.values()].reduce((s, l) => s + l.length, 0)
  }
}
