import type { Block, Checkin, Kind, Msg, MsgBody, MsgData, MsgKind, Rec, RecOf, Report, ReportType, SosNeed, SpaceWhat, Telemetry, TriageOutcome } from './types'
import { isBeyond, makeBlocks, officialBulletin, simulateTick, TOTAL_TICKS } from './sim/world'
import type { Official } from './sim/world'
import { makeEdges, probeHistory, volunteers } from './sim/hollow'
import type { Dataset } from './engine/dataset'
import { computeTruth, REPORT_KIND } from './engine/trust'
import type { BlockTruth } from './engine/trust'
import { computeAlerts } from './engine/warning'
import type { Alert } from './engine/warning'
import { computeOutbreak } from './engine/outbreak'
import type { BlockOutbreak, Outbreak } from './engine/outbreak'
import { computeReputation, repOf } from './engine/reputation'
import type { Rep } from './engine/reputation'
import { fingerprint, phraseHash, signBody, uid } from './mesh/crypto'
import type { Identity } from './mesh/crypto'
import { GossipNode } from './mesh/gossip'
import type { CatchUp } from './mesh/gossip'
import { BroadcastTransport, SocketTransport } from './mesh/transport'
import { Swarm } from './mesh/swarm'
import { loadIdentity, loadOutbox, saveOutbox } from './db'
import { computeModules } from './modules/compute'
import type { ModuleSnapshot, RouteTarget } from './modules/compute'
import type { ChainCheck, ProbeMsg } from './modules/surface'
import { verifyChain } from './modules/surface'
import { TABS } from './modules/registry'
import { briefing } from './modules/briefing'
import type { Briefing } from './modules/briefing'

export type TabId = 'alerts' | 'outbreak' | 'heat' | 'surface' | 'share' | 'care' | 'food' | 'space' | 'light' | 'return' | 'mesh' | 'routes' | 'family'
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

export interface AttackInfo {
  blockId: string
  /** Distinct keys used (1 for the single-device flood). */
  keys: number
  reports: number
}

export interface RealDevice {
  deviceKey: string
  pub: string
  lastWall: number
  rep: Rep
  phone: boolean
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
  attack: AttackInfo | null
  checkins: Checkin[]
  mesh: {
    peers: number
    phones: number
    accepted: number
    duplicates: number
    invalid: number
    relayed: number
    /** Sensor-type readings signed by a key that is not a registered sensor (dropped). */
    spoofed: number
    /** Real-device messages too old to count as live (kept and forwarded, not shown as current). */
    stale: number
    devices: number
    pending: number
    messages: number
    links: { name: string; up: boolean }[]
    catchUp: CatchUp | null
  }
  relayUrls: string[]
  realDevices: RealDevice[]
  demo: { active: boolean; step: number; steps: number; title: string; caption: string }
  me: string
  myRep: Rep
  mod: ModuleSnapshot
  routeTarget: RouteTarget
  chain: Map<string, ChainCheck | null>
  chainBusy: string | null
  tampered: boolean
  lit: Set<number>
  /** Recent events from real devices (phones, other tabs), newest first. */
  feed: { id: string; wall: number; text: string }[]
  /** What the user needs to know and do about their own block right now. */
  brief: Briefing
  /** Block whose SOS this device has answered. */
  helping: string | null
}

const HOME_KEY = 'lantern.home'
const DEFAULT_HOME = 'L9-B2'
export const TAMPER_PROBE = 'A'
export const TAMPER_SEQ = 120
export const RELAY_PORT = 8787

const readHome = (): string => {
  try {
    return localStorage.getItem(HOME_KEY) ?? DEFAULT_HOME
  } catch {
    return DEFAULT_HOME
  }
}

export const normalisePhrase = (p: string) => p.trim().toLowerCase()

/** Where the community relay lives: same origin when it served this page, else port 8787 on this host. */
export function relayBase(): { http: string; ws: string } {
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('relay') : null
  if (q) return { http: q.replace(/^ws/, 'http').replace(/\/mesh$/, ''), ws: q }
  const host = typeof location !== 'undefined' && location.hostname ? location.hostname : 'localhost'
  const servedByRelay = typeof location !== 'undefined' && location.port === String(RELAY_PORT)
  const http = servedByRelay ? location.origin : `http://${host}:${RELAY_PORT}`
  return { http, ws: `${http.replace(/^http/, 'ws')}/mesh` }
}

type ModKinds = 'sos' | 'respond' | 'gauge' | 'pulse' | 'triage' | 'space' | 'plot' | 'vouch'
type ModRecs = { [K in ModKinds]: RecOf<K>[] }
const emptyRecs = (): ModRecs => ({ sos: [], respond: [], gauge: [], pulse: [], triage: [], space: [], plot: [], vouch: [] })

const ACTIVITY: Partial<Record<MsgKind, string>> = {
  checkin: 'checked in OK',
  sos: 'sent an SOS',
  respond: 'is answering an SOS',
  report: 'filed a report',
  triage: 'shared a triage outcome',
  pulse: 'sent a wellbeing pulse',
  space: 'posted on the space board',
  vouch: 'vouched for a device',
}

/** Readings only an installed, registered device may sign. */
const SENSOR_KINDS = new Set<MsgKind>(['telemetry', 'gauge', 'probe'])
/**
 * Real devices don't share the simulated clock, so their messages count as "now" when they
 * arrive. That is only honest for recent ones: a report or SOS from an earlier session (the relay
 * keeps everything) must not reappear as a fresh event. Family check-ins stay useful for a day.
 */
export const LIVE_MS = 30 * 60_000
export const CHECKIN_MS = 24 * 60 * 60_000
const FUTURE_SLACK_MS = 10 * 60_000
export function isStale(m: Pick<Msg, 'wall' | 'data'>, now = Date.now()): boolean {
  if (m.wall > now + FUTURE_SLACK_MS) return true
  return now - m.wall > (m.data.k === 'checkin' ? CHECKIN_MS : LIVE_MS)
}

export class LanternStore {
  readonly blocks = makeBlocks()
  readonly edges = makeEdges()
  private blockById = new Map(this.blocks.map((b) => [b.id, b]))
  private seed = 7
  private volunteers = volunteers(this.seed)

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
  private familyHash: string | null = null
  private attack: AttackInfo | null = null
  private demo = { active: false, step: 0, steps: 0, title: '', caption: '' }
  private routeTarget: RouteTarget = 'clinic'
  private helping: string | null = null
  private lit = new Set<number>()
  private sensorKeys = new Set<string>()
  private spoofed = 0
  private stale = 0

  private telemetry = new Map<string, Telemetry[]>()
  private reports: Report[] = []
  private checkins: Checkin[] = []
  private recs: ModRecs = emptyRecs()
  private agree = new Map<string, Set<number>>()
  private established = new Set<string>()
  private realDevices = new Map<string, { pub: string; lastWall: number; phone: boolean }>()
  private feed: { id: string; wall: number; text: string }[] = []

  private probesOriginal: ProbeMsg[] = []
  private probes: ProbeMsg[] = []
  private chain = new Map<string, ChainCheck | null>()
  private chainBusy: string | null = null
  private tampered = false

  private me!: Identity
  private swarm!: Swarm
  private node: GossipNode
  private ready = false
  private initPromise: Promise<void> | null = null
  private relayUrls: string[] = []

  private listeners = new Set<() => void>()
  private snap: Snapshot
  private scheduled = false

  constructor() {
    this.node = new GossipNode(
      (m) => this.apply(m),
      () => this.schedule(),
      { role: 'laptop', dev: () => (this.ready ? this.me.deviceKey : '') },
      (m) => this.acceptable(m),
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
    this.sensorKeys = this.swarm.sensorKeys()
    this.established = new Set([...this.swarm.memberKeys(), this.me.deviceKey])
    this.node.start([new BroadcastTransport(), new SocketTransport(relayBase().ws)])
    window.addEventListener('pagehide', () => this.node.stop())
    for (const m of await loadOutbox()) await this.node.ingest(m)

    this.probesOriginal = await this.swarm.probeChain(probeHistory(this.seed), Date.now())
    for (const m of this.probesOriginal) await this.node.ingest(m)
    this.probes = this.probesOriginal.map((m) => ({ ...m, data: { ...m.data } }))

    this.ready = true
    this.emit()
    void this.verifyAll()
    void this.fetchRelayInfo()
  }

  private async fetchRelayInfo() {
    for (;;) {
      try {
        const res = await fetch(`${relayBase().http}/api/info`)
        if (res.ok) {
          const info = (await res.json()) as { urls: string[] }
          this.relayUrls = info.urls
          this.emit()
          return
        }
      } catch {
        /* relay not running yet */
      }
      await new Promise((r) => setTimeout(r, 8000))
    }
  }

  private noteDevice(m: Msg, deviceKey: string, kind: MsgKind) {
    if (m.origin !== 'user' || m.pub === this.me.pub) return
    const peerPhone = [...this.node.peers.values()].some((p) => p.role === 'phone' && p.dev === deviceKey)
    const prev = this.realDevices.get(deviceKey)
    this.realDevices.set(deviceKey, { pub: m.pub, lastWall: Math.max(prev?.lastWall ?? 0, m.wall), phone: peerPhone || !!prev?.phone })
    const what = ACTIVITY[kind]
    if (what) {
      const where = kind === 'vouch' ? '' : ` on ${m.blockId}`
      this.feed.unshift({ id: m.id, wall: Date.now(), text: `${peerPhone ? 'Phone' : 'Device'} ${deviceKey.slice(0, 6)} ${what}${where}` })
      this.feed = this.feed.slice(0, 12)
    }
  }

  /** Local policy, checked before a message is stored or forwarded. */
  private acceptable(m: Msg): boolean {
    if (SENSOR_KINDS.has(m.data.k) && !this.sensorKeys.has(m.pub)) {
      this.spoofed++
      return false
    }
    return true
  }

  private apply(m: Msg) {
    const deviceKey = fingerprint(m.pub)
    const d = m.data
    if (m.origin === 'user' && isStale(m)) {
      // Kept in the log (so it still reaches peers that missed it) but not shown as happening now.
      this.stale++
      return
    }
    // Real devices (phones, other tabs) don't share our simulated clock: use arrival time.
    const ts = m.origin === 'user' ? this.tick : m.ts
    this.noteDevice(m, deviceKey, d.k)
    const rec = <D extends MsgData>(data: D): Rec<D> => ({ id: m.id, blockId: m.blockId, ts, wall: m.wall, deviceKey, pub: m.pub, mine: m.pub === this.me.pub, virtual: m.origin === 'swarm', data })

    switch (d.k) {
      case 'telemetry': {
        const list = this.telemetry.get(m.blockId) ?? []
        list.push({ blockId: m.blockId, ts, power: d.power, water: d.water, temp: d.temp, air: d.air, rh: d.rh, deviceKey })
        if (list.length > 200) list.shift()
        this.telemetry.set(m.blockId, list)
        break
      }
      case 'report': {
        this.reports.push({ id: m.id, blockId: m.blockId, type: d.type, ts, deviceKey })
        this.noteAgreement(m.blockId, d.type, ts, deviceKey)
        break
      }
      case 'checkin':
        this.checkins.push({ id: m.id, blockId: m.blockId, wall: m.wall, deviceKey, codeHash: d.codeHash, mine: m.pub === this.me.pub, virtual: m.origin === 'swarm' })
        break
      case 'probe':
        break // kept in the Proof-of-Air ledger, not here
      default:
        ;(this.recs[d.k] as Rec[]).push(rec(d))
    }
    this.schedule()
  }

  /** Earned trust: a report confirmed by the block's own sensor in the same tick. */
  private noteAgreement(blockId: string, type: ReportType, ts: number, deviceKey: string) {
    const kind = REPORT_KIND[type]
    const list = this.telemetry.get(blockId)
    if (!kind || !list) return
    for (let i = list.length - 1; i >= 0 && list[i].ts >= ts - 1; i--) {
      if (list[i].ts === ts && isBeyond(kind, list[i][kind])) {
        const set = this.agree.get(deviceKey) ?? new Set<number>()
        set.add(Math.floor(ts / 6))
        this.agree.set(deviceKey, set)
        return
      }
    }
  }

  // ---------- simulation clock ----------
  private async step() {
    const next = this.tick + 1
    const homeLevel = this.blockById.get(this.homeBlock)?.level ?? 9
    const out = simulateTick(this.seed, next, this.blocks)
    const msgs = await this.swarm.messagesFor(out, homeLevel, Date.now())
    // The tick advances first so messages are stamped with the tick they belong to.
    this.tick = next
    await Promise.all(msgs.map((m) => this.node.ingest(m)))
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

  /** Restart the simulated day. Check-ins and messages from real people are kept. */
  async reset() {
    this.pause()
    while (this.busy) await new Promise((r) => setTimeout(r, 20))
    this.tick = 0
    this.acc = 0
    this.telemetry.clear()
    // Real people's messages survive a restart of the simulated day, re-stamped to its start so
    // they don't sit in the future and replay when the clock reaches their old tick.
    this.reports = this.reports.filter((r) => this.realDevices.has(r.deviceKey) || r.deviceKey === this.me?.deviceKey).map((r) => ({ ...r, ts: 0 }))
    this.checkins = this.checkins.filter((c) => !c.virtual)
    const keep = <T extends Rec>(xs: T[]) => xs.filter((x) => !x.virtual).map((x) => ({ ...x, ts: 0 }))
    this.recs = { sos: keep(this.recs.sos), respond: keep(this.recs.respond), gauge: [], pulse: keep(this.recs.pulse), triage: keep(this.recs.triage), space: keep(this.recs.space), plot: keep(this.recs.plot), vouch: keep(this.recs.vouch) }
    this.helping = null
    this.agree.clear()
    this.node.dropSwarm()
    for (const m of this.probesOriginal) this.node.log.set(m.id, m)
    this.attack = null
    this.frozenOfficial = null
    this.uplink = true
    this.trustOn = true
    this.lit.clear()
    this.routeTarget = 'clinic'
    if (this.tampered) {
      this.tampered = false
      this.probes = this.probesOriginal.map((m) => ({ ...m, data: { ...m.data } }))
      void this.verifyAll()
    }
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
    // During the demo the script lights problems beat by beat, so the strip fills in order.
    if (!this.demo.active) for (const p of TABS.find((x) => x.id === t)?.problems ?? []) this.lit.add(p)
    this.emit()
  }

  /** Mark problems as shown (the demo calls this as it reaches each module). */
  light = (...problems: number[]) => {
    for (const p of problems) this.lit.add(p)
    this.emit()
  }

  setPhrase = (p: string) => {
    this.phrase = p
    const norm = normalisePhrase(p)
    if (!norm) this.familyHash = null
    else
      void phraseHash(norm).then((h) => {
        if (normalisePhrase(this.phrase) === norm) {
          this.familyHash = h
          this.emit()
        }
      })
    this.emit()
  }

  setDemo = (d: Partial<typeof this.demo>) => {
    this.demo = { ...this.demo, ...d }
    this.emit()
  }

  setRouteTarget = (t: RouteTarget) => {
    this.routeTarget = t
    this.emit()
  }

  // ---------- user actions (signed, gossiped, persisted) ----------
  private async publishUser(blockId: string, data: MsgData) {
    const body: MsgBody = { id: `u-${uid()}`, blockId, ts: this.tick, wall: Date.now(), data }
    const m = await signBody(this.me, body, 'user')
    await this.node.ingest(m)
    this.node.publish(m)
    await saveOutbox(m)
  }

  submitReport = (type: ReportType) => this.publishUser(this.homeBlock, { k: 'report', type })
  sendSos = (need: SosNeed) => this.publishUser(this.homeBlock, { k: 'sos', need })
  sendTriage = (outcome: TriageOutcome) => this.publishUser(this.homeBlock, { k: 'triage', outcome })
  sendPulse = (sleep: number, mood: number, light: number) => this.publishUser(this.homeBlock, { k: 'pulse', sleep, mood, light })
  postSpace = (mode: 'offer' | 'request', what: SpaceWhat, slots: number) => this.publishUser(this.homeBlock, { k: 'space', mode, what, slots })
  vouch = (pub: string) => this.publishUser(this.homeBlock, { k: 'vouch', target: pub })

  /** "I'm on my way" to the SOS in `blockId`: tells everyone it is covered and routes me there. */
  respondTo = async (blockId: string) => {
    this.helping = blockId
    this.routeTarget = 'sos'
    this.emit()
    await this.publishUser(this.homeBlock, { k: 'respond', to: blockId })
  }

  checkIn = async (phrase: string) => {
    const codeHash = await phraseHash(normalisePhrase(phrase))
    await this.publishUser(this.homeBlock, { k: 'checkin', codeHash })
  }

  /** One device floods a healthy block with fake outage reports. */
  spamAttack = async (blockId = 'L2-B2', n = 100) => {
    const homeLevel = this.blockById.get(this.homeBlock)?.level ?? 9
    const msgs = await this.swarm.spam(blockId, n, this.tick, Date.now(), homeLevel)
    this.attack = { blockId, keys: 1, reports: n }
    await Promise.all(msgs.map((m) => this.node.ingest(m)))
    this.emit()
  }

  /** Fifty brand-new keys, two fake reports each. */
  sybilAttack = async (blockId = 'L2-B2', keys = 50, perKey = 2) => {
    const homeLevel = this.blockById.get(this.homeBlock)?.level ?? 9
    const msgs = await this.swarm.sybil(blockId, keys, perKey, this.tick, Date.now(), homeLevel)
    this.attack = { blockId, keys, reports: keys * perKey }
    await Promise.all(msgs.map((m) => this.node.ingest(m)))
    this.emit()
  }

  // ---------- Proof of Air ----------
  verifyAll = async () => {
    for (const p of ['A', 'B', 'C']) await this.verifyProbe(p)
  }

  verifyProbe = async (probe: string) => {
    this.chainBusy = probe
    this.chain.set(probe, null)
    this.emit()
    const entries = this.probes.filter((m) => m.data.probe === probe).sort((a, b) => a.data.seq - b.data.seq)
    const registered = this.probesOriginal.find((m) => m.data.probe === probe)?.pub
    const result = await verifyChain(entries, registered)
    this.chain.set(probe, result)
    this.chainBusy = null
    this.emit()
  }

  /** Someone edits one old reading to make the air look lethal. Its signature no longer matches. */
  tamper = async () => {
    this.tampered = true
    this.probes = this.probes.map((m) => (m.data.probe === TAMPER_PROBE && m.data.seq === TAMPER_SEQ ? { ...m, data: { ...m.data, aqi: 420 } } : m))
    await this.verifyProbe(TAMPER_PROBE)
  }

  /** Every device holds a copy of the probe log, so the honest version is restored from peers. */
  restoreProbes = async () => {
    if (!this.tampered) return
    this.tampered = false
    this.probes = this.probesOriginal.map((m) => ({ ...m, data: { ...m.data } }))
    await this.verifyProbe(TAMPER_PROBE)
  }

  probeLedger(probe: string): ProbeMsg[] {
    return this.probes.filter((m) => m.data.probe === probe).sort((a, b) => a.data.seq - b.data.seq)
  }

  series(blockId: string, kind: Kind | 'rh'): number[] {
    return (this.telemetry.get(blockId) ?? []).map((t) => t[kind])
  }

  // ---------- derived state ----------
  private build(): Snapshot {
    const agreeHours = new Map([...this.agree].map(([k, s]) => [k, s.size]))
    const rep = computeReputation({
      established: this.established,
      vouches: this.recs.vouch.map((v) => ({ from: v.deviceKey, to: fingerprint(v.data.target), ts: v.wall })),
      agreeHours,
    })
    const ds: Dataset = { blocks: this.blocks, telemetry: this.telemetry, reports: this.reports, now: this.tick, trustOn: this.trustOn, rep }
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

    const latest = new Map<string, Telemetry>()
    for (const [id, list] of this.telemetry) if (list.length) latest.set(id, list[list.length - 1])

    const family = this.familyHash ? this.checkins.filter((c) => c.codeHash === this.familyHash && !c.mine).sort((a, b) => b.wall - a.wall)[0] : undefined

    const mod = computeModules({
      blocks: this.blocks,
      edges: this.edges,
      now: this.tick,
      latest,
      truth,
      recs: this.recs,
      home: this.homeBlock,
      routeTarget: this.routeTarget,
      familyBlock: family?.blockId ?? null,
      helping: this.helping,
      probes: this.probes,
      chain: this.chain,
      volunteers: this.volunteers,
    })

    const brief = briefing({
      home: this.homeBlock,
      edges: this.edges,
      flagged: (id) => views.get(id)?.truth.flaggedKinds ?? [],
      outbreakFlagged: (id) => !!views.get(id)?.outbreak.flagged,
      alerts,
      heat: mod.heat.rows,
      coolRoute: mod.coolRoute,
      waterRoute: mod.waterRoute,
      flood: mod.flood,
      sos: mod.sos,
      responders: mod.responders,
      helping: this.helping,
      family: family ? { blockId: family.blockId, minutesAgo: Math.max(0, Math.round((Date.now() - family.wall) / 60_000)) } : null,
    })

    const peers = this.node.peerList()
    const stats = this.node.stats
    const realDevices: RealDevice[] = [...this.realDevices]
      .map(([deviceKey, d]) => ({ deviceKey, pub: d.pub, lastWall: d.lastWall, phone: d.phone || peers.some((p) => p.dev === deviceKey && p.role === 'phone'), rep: repOf(rep, deviceKey) }))
      .sort((a, b) => b.lastWall - a.lastWall)

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
      attack: this.attack,
      checkins: [...this.checkins].sort((a, b) => b.wall - a.wall),
      mesh: {
        peers: peers.length,
        phones: peers.filter((p) => p.role === 'phone').length,
        accepted: stats.accepted,
        duplicates: stats.duplicates,
        invalid: stats.invalid,
        relayed: stats.relayed,
        spoofed: this.spoofed,
        stale: this.stale,
        devices: this.ready ? this.swarm.deviceCount : 0,
        pending: this.ready ? this.node.pendingFor(this.me.pub) : 0,
        messages: this.node.log.size,
        links: this.node.links(),
        catchUp: this.node.lastCatchUp,
      },
      relayUrls: this.relayUrls,
      realDevices,
      demo: this.demo,
      me: this.ready ? this.me.deviceKey : '',
      myRep: this.ready ? repOf(rep, this.me.deviceKey) : { weight: 1, status: 'established' },
      mod,
      routeTarget: this.routeTarget,
      chain: new Map(this.chain),
      chainBusy: this.chainBusy,
      tampered: this.tampered,
      lit: new Set(this.lit),
      feed: this.feed,
      brief,
      helping: this.helping,
    }
  }
}

export const store = new LanternStore()
