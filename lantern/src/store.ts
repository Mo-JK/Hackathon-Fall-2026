import type { Block, Checkin, Kind, Msg, MsgBody, Report, ReportType, Telemetry } from './types'
import { makeBlocks, officialBulletin, simulateTick, TOTAL_TICKS } from './sim/world'
import type { Official } from './sim/world'
import type { Dataset } from './engine/dataset'
import { computeTruth } from './engine/trust'
import type { BlockTruth } from './engine/trust'
import { computeAlerts } from './engine/warning'
import type { Alert } from './engine/warning'
import { computeOutbreak } from './engine/outbreak'
import type { BlockOutbreak, Outbreak } from './engine/outbreak'
import { fingerprint, sha256Hex, signBody } from './mesh/crypto'
import type { Identity } from './mesh/crypto'
import { GossipNode } from './mesh/gossip'
import { Swarm } from './mesh/swarm'
import { loadIdentity, loadOutbox, saveOutbox } from './db'

export type TabId = 'alerts' | 'outbreak' | 'share' | 'mesh' | 'family'
export type Status = 'ok' | 'warn' | 'critical'

export interface BlockView {
  block: Block
  status: Status
  officialStatus: 'NORMAL' | 'MAINTENANCE'
  truth: BlockTruth
  alerts: Alert[]
  outbreak: BlockOutbreak
  /** Confirmed hazards used to scale this block's need in the allocation. */
  hazards: number
}

export interface SpamInfo {
  blockId: string
  n: number
}

export interface Snapshot {
  ready: boolean
  tick: number
  total: number
  playing: boolean
  speed: number
  uplink: boolean
  trustOn: boolean
  homeBlock: string
  selected: string | null
  tab: TabId
  phrase: string
  official: Official
  views: Map<string, BlockView>
  alerts: Alert[]
  outbreak: Outbreak
  rejected: number
  spam: SpamInfo | null
  checkins: Checkin[]
  mesh: { peers: number; accepted: number; duplicates: number; invalid: number; relayed: number; devices: number; pending: number; messages: number }
  demo: { active: boolean; step: number; steps: number; title: string; caption: string }
  me: string
}

const HOME_KEY = 'lantern.home'
const DEFAULT_HOME = 'L9-B2'

const readHome = (): string => {
  try {
    return localStorage.getItem(HOME_KEY) ?? DEFAULT_HOME
  } catch {
    return DEFAULT_HOME
  }
}

export const normalisePhrase = (p: string) => p.trim().toLowerCase()

export class LanternStore {
  readonly blocks = makeBlocks()
  private blockById = new Map(this.blocks.map((b) => [b.id, b]))
  private seed = 7

  private tick = 0
  private playing = false
  private speed = 2
  private acc = 0
  private busy = false
  private timer: ReturnType<typeof setInterval> | null = null

  private uplink = true
  private frozenOfficial: Official | null = null
  private trustOn = true
  private homeBlock = readHome()
  private selected: string | null = null
  private tab: TabId = 'alerts'
  private phrase = ''
  private spam: SpamInfo | null = null
  private demo = { active: false, step: 0, steps: 0, title: '', caption: '' }

  private telemetry = new Map<string, Telemetry[]>()
  private reports: Report[] = []
  private checkins: Checkin[] = []

  private me!: Identity
  private swarm!: Swarm
  private node: GossipNode
  private ready = false
  private initPromise: Promise<void> | null = null

  private listeners = new Set<() => void>()
  private snap: Snapshot
  private scheduled = false

  constructor() {
    this.node = new GossipNode(
      (m) => this.apply(m),
      () => this.schedule(),
    )
    this.snap = this.build()
  }

  // ---------- React plumbing ----------
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.snap

  private emit() {
    this.snap = this.build()
    this.listeners.forEach((l) => l())
  }

  /** Coalesce bursts of incoming messages into one recompute. */
  private schedule() {
    if (this.scheduled) return
    this.scheduled = true
    setTimeout(() => {
      this.scheduled = false
      this.emit()
    }, 60)
  }

  // ---------- lifecycle ----------
  init(): Promise<void> {
    this.initPromise ??= this.doInit()
    return this.initPromise
  }

  private async doInit() {
    this.me = await loadIdentity()
    this.swarm = await Swarm.create(this.blocks)
    this.node.start()
    window.addEventListener('pagehide', () => this.node.stop())
    for (const m of await loadOutbox()) await this.node.ingest(m)
    this.ready = true
    this.emit()
  }

  private apply(m: Msg) {
    const deviceKey = fingerprint(m.pub)
    const d = m.data
    if (d.k === 'telemetry') {
      const list = this.telemetry.get(m.blockId) ?? []
      list.push({ blockId: m.blockId, ts: m.ts, power: d.power, water: d.water, temp: d.temp, air: d.air, deviceKey })
      if (list.length > 200) list.shift()
      this.telemetry.set(m.blockId, list)
    } else if (d.k === 'report') {
      this.reports.push({ id: m.id, blockId: m.blockId, type: d.type, ts: m.ts, deviceKey })
    } else {
      this.checkins.push({
        id: m.id,
        blockId: m.blockId,
        wall: m.wall,
        deviceKey,
        codeHash: d.codeHash,
        mine: m.pub === this.me.pub,
        virtual: m.origin === 'swarm',
      })
    }
    this.schedule()
  }

  // ---------- simulation clock ----------
  private async step() {
    const next = this.tick + 1
    const homeLevel = this.blockById.get(this.homeBlock)?.level ?? 9
    const out = simulateTick(this.seed, next, this.blocks)
    const msgs = await this.swarm.messagesFor(out, homeLevel, Date.now())
    await Promise.all(msgs.map((m) => this.node.ingest(m)))
    this.tick = next
    this.emit()
  }

  private loop = async () => {
    if (this.busy || !this.playing) return
    this.busy = true
    try {
      this.acc += this.speed * 0.1
      while (this.acc >= 1 && this.playing && this.tick < TOTAL_TICKS) {
        this.acc -= 1
        await this.step()
      }
      if (this.tick >= TOTAL_TICKS) this.playing = false
    } finally {
      this.busy = false
      this.emit()
    }
  }

  play = () => {
    if (!this.ready || this.playing) return
    if (this.tick >= TOTAL_TICKS) return
    this.playing = true
    this.timer = setInterval(this.loop, 100)
    this.emit()
  }

  pause = () => {
    this.playing = false
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.emit()
  }

  setSpeed = (ticksPerSecond: number) => {
    this.speed = Math.max(0.1, ticksPerSecond)
    this.emit()
  }

  /** Restart the simulated day. Check-ins from real people are kept. */
  async reset() {
    this.pause()
    while (this.busy) await new Promise((r) => setTimeout(r, 20))
    this.tick = 0
    this.acc = 0
    this.telemetry.clear()
    this.reports = []
    this.checkins = this.checkins.filter((c) => !c.virtual)
    this.node.dropSwarm()
    this.spam = null
    this.frozenOfficial = null
    this.uplink = true
    this.trustOn = true
    this.emit()
  }

  // ---------- switches ----------
  setUplink = (on: boolean) => {
    if (on === this.uplink) return
    this.uplink = on
    this.frozenOfficial = on ? null : officialBulletin(this.tick, this.blocks)
    this.emit()
  }

  setTrust = (on: boolean) => {
    this.trustOn = on
    this.emit()
  }

  setHome = (id: string) => {
    this.homeBlock = id
    try {
      localStorage.setItem(HOME_KEY, id)
    } catch {
      /* ignore */
    }
    this.emit()
  }

  select = (id: string | null) => {
    this.selected = id
    this.emit()
  }

  setTab = (t: TabId) => {
    this.tab = t
    this.emit()
  }

  setPhrase = (p: string) => {
    this.phrase = p
    this.emit()
  }

  setDemo = (d: Partial<typeof this.demo>) => {
    this.demo = { ...this.demo, ...d }
    this.emit()
  }

  // ---------- user actions (signed, gossiped, persisted) ----------
  private async publishUser(body: MsgBody) {
    const m = await signBody(this.me, body, 'user')
    await this.node.ingest(m)
    this.node.publish(m)
    if (body.data.k === 'checkin') await saveOutbox(m)
  }

  submitReport = async (type: ReportType) => {
    await this.publishUser({ id: `u-${crypto.randomUUID()}`, blockId: this.homeBlock, ts: this.tick, wall: Date.now(), data: { k: 'report', type } })
  }

  checkIn = async (phrase: string) => {
    const codeHash = await sha256Hex(normalisePhrase(phrase))
    await this.publishUser({ id: `u-${crypto.randomUUID()}`, blockId: this.homeBlock, ts: this.tick, wall: Date.now(), data: { k: 'checkin', codeHash } })
  }

  /** One device floods a healthy block with fake outage reports. */
  spamAttack = async (blockId = 'L2-B2', n = 100) => {
    const homeLevel = this.blockById.get(this.homeBlock)?.level ?? 9
    const msgs = await this.swarm.spam(blockId, n, this.tick, Date.now(), homeLevel)
    this.spam = { blockId, n }
    await Promise.all(msgs.map((m) => this.node.ingest(m)))
    this.emit()
  }

  series(blockId: string, kind: Kind): number[] {
    return (this.telemetry.get(blockId) ?? []).map((t) => t[kind])
  }

  // ---------- derived state ----------
  private build(): Snapshot {
    const ds: Dataset = { blocks: this.blocks, telemetry: this.telemetry, reports: this.reports, now: this.tick, trustOn: this.trustOn }
    const truth = computeTruth(ds)
    const alerts = computeAlerts(ds, truth)
    const outbreak = computeOutbreak(ds)
    const official = this.frozenOfficial ?? officialBulletin(this.tick, this.blocks)

    const alertsByBlock = new Map<string, Alert[]>()
    for (const a of alerts) {
      const list = alertsByBlock.get(a.blockId) ?? []
      list.push(a)
      alertsByBlock.set(a.blockId, list)
    }

    const views = new Map<string, BlockView>()
    let rejected = 0
    for (const b of this.blocks) {
      const t = truth.get(b.id)!
      const ob = outbreak.blocks.get(b.id)!
      const al = alertsByBlock.get(b.id) ?? []
      rejected += t.rejected
      const status: Status = t.flaggedKinds.length ? 'critical' : al.length || ob.flagged ? 'warn' : 'ok'
      views.set(b.id, {
        block: b,
        status,
        officialStatus: official.maintenanceLevels.includes(b.level) ? 'MAINTENANCE' : 'NORMAL',
        truth: t,
        alerts: al,
        outbreak: ob,
        hazards: t.flaggedKinds.length + (ob.flagged ? 1 : 0),
      })
    }

    const stats = this.node.stats
    return {
      ready: this.ready,
      tick: this.tick,
      total: TOTAL_TICKS,
      playing: this.playing,
      speed: this.speed,
      uplink: this.uplink,
      trustOn: this.trustOn,
      homeBlock: this.homeBlock,
      selected: this.selected,
      tab: this.tab,
      phrase: this.phrase,
      official,
      views,
      alerts,
      outbreak,
      rejected,
      spam: this.spam,
      checkins: [...this.checkins].sort((a, b) => b.wall - a.wall),
      mesh: {
        peers: this.node.peerCount(),
        accepted: stats.accepted,
        duplicates: stats.duplicates,
        invalid: stats.invalid,
        relayed: stats.relayed,
        devices: this.ready ? this.swarm.deviceCount : 0,
        pending: this.ready ? this.node.pendingFor(this.me.pub) : 0,
        messages: this.node.log.size,
      },
      demo: this.demo,
      me: this.ready ? this.me.deviceKey : '',
    }
  }
}

export const store = new LanternStore()
