import type { Block, Msg, MsgBody } from '../types'
import { RESIDENT_DEVICES_PER_BLOCK } from '../sim/world'
import type { SimOutput } from '../sim/world'
import type { Identity } from './crypto'
import { newIdentity, sha256Hex, signBody } from './crypto'

/**
 * The simulated population of other devices in the mesh. Each sensor and resident
 * device has its own keypair and signs what it sends, exactly as a real device would.
 * The radio link is the only simulated part.
 */
export class Swarm {
  private sensors = new Map<string, Identity>()
  private residents = new Map<string, Identity[]>()
  private counter = 0
  private constructor(private attacker: Identity) {}

  static async create(blocks: Block[]): Promise<Swarm> {
    const swarm = new Swarm(await newIdentity())
    await Promise.all(
      blocks.map(async (b) => {
        if (b.hasSensor) swarm.sensors.set(b.id, await newIdentity())
        swarm.residents.set(b.id, await Promise.all(Array.from({ length: RESIDENT_DEVICES_PER_BLOCK }, newIdentity)))
      }),
    )
    return swarm
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
    for (const t of out.telemetry) {
      const who = this.sensors.get(t.blockId)!
      jobs.push(
        this.make(
          who,
          { id: this.id('t'), blockId: t.blockId, ts: t.ts, wall, data: { k: 'telemetry', power: t.power, water: t.water, temp: t.temp, air: t.air } },
          this.hopsFor(t.blockId, homeLevel),
        ),
      )
    }
    for (const r of out.reports) {
      const who = this.residents.get(r.blockId)![r.slot]
      jobs.push(this.make(who, { id: this.id('r'), blockId: r.blockId, ts: r.ts, wall, data: { k: 'report', type: r.type } }, this.hopsFor(r.blockId, homeLevel)))
    }
    for (const c of out.checkins) {
      const who = this.residents.get(c.blockId)![0]
      const codeHash = await sha256Hex(c.phrase)
      jobs.push(this.make(who, { id: this.id('c'), blockId: c.blockId, ts: c.ts, wall, data: { k: 'checkin', codeHash } }, this.hopsFor(c.blockId, homeLevel)))
    }
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

  get deviceCount() {
    return this.sensors.size + [...this.residents.values()].reduce((s, l) => s + l.length, 0)
  }
}
