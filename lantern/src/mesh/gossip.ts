import type { Msg } from '../types'
import { uid, verifyMsg } from './crypto'
import type { Role, Transport, Wire } from './transport'
import { validMsg } from './validate'

export const MAX_HOPS = 16

const PEER_TTL_MS = 25_000
const HEARTBEAT_MS = 10_000
/** Messages accepted this soon after a link comes back count as "caught up". */
const CATCH_UP_WINDOW_MS = 4_000

export interface GossipStats {
  accepted: number
  duplicates: number
  /** Dropped: bad signature or out-of-range hop count. */
  invalid: number
  relayed: number
}

export interface PeerInfo {
  seen: number
  via: string
  role?: Role
  dev?: string
}

export interface CatchUp {
  via: string
  at: number
  n: number
  /** False on a link's first connection (joining), true when it comes back after dropping. */
  reconnect: boolean
}

/**
 * Store-and-forward gossip over any number of transports. Every accepted message is kept in
 * `log`. When a link (re)connects we say hello; peers answer with an inventory of their user
 * messages, we ask for what we lack, and they send it (anti-entropy). Messages are signed,
 * deduplicated by id and carry a hop budget. Simulated-swarm traffic stays local.
 */
export class GossipNode {
  readonly nodeId = uid()
  readonly log = new Map<string, Msg>()
  readonly peers = new Map<string, PeerInfo>()
  stats: GossipStats = { accepted: 0, duplicates: 0, invalid: 0, relayed: 0 }
  lastCatchUp: CatchUp | null = null
  private beat: ReturnType<typeof setInterval> | null = null
  private transports: Transport[] = []
  private catchUpUntil = 0
  private connects = new Map<string, number>()

  constructor(
    private onAccept: (m: Msg) => void,
    private onChange: () => void,
    private me: { role: Role; dev: () => string } = { role: 'laptop', dev: () => '' },
    /** Local policy on top of the structural check, e.g. "sensor readings only from registered sensor keys". */
    private accept: (m: Msg) => boolean = () => true,
  ) {}

  start(transports: Transport[]) {
    this.transports = transports
    for (const t of transports) {
      t.start(
        (w) => void this.onWire(w, t.name),
        () => this.connected(t),
        () => this.onChange(),
      )
    }
    this.beat = setInterval(() => {
      this.hello()
      this.onChange()
    }, HEARTBEAT_MS)
  }

  stop() {
    this.send({ t: 'bye', from: this.nodeId })
    if (this.beat) clearInterval(this.beat)
    for (const t of this.transports) t.stop()
  }

  links(): { name: string; up: boolean }[] {
    return this.transports.map((t) => ({ name: t.name, up: t.connected() }))
  }

  private connected(t: Transport) {
    this.catchUpUntil = Date.now() + CATCH_UP_WINDOW_MS
    const count = (this.connects.get(t.name) ?? 0) + 1
    this.connects.set(t.name, count)
    this.lastCatchUp = { via: t.name, at: Date.now(), n: 0, reconnect: count > 1 }
    this.hello()
    // Offer everything we hold so a peer that missed it while we were apart catches up.
    const mine = this.userMsgs()
    if (mine.length) t.send({ t: 'msgs', from: this.nodeId, msgs: mine })
    this.onChange()
  }

  private hello() {
    this.send({ t: 'hello', from: this.nodeId, role: this.me.role, dev: this.me.dev() })
  }

  /** Peers heard from recently. */
  peerList(): (PeerInfo & { id: string })[] {
    const cutoff = Date.now() - PEER_TTL_MS
    for (const [id, p] of this.peers) if (p.seen < cutoff) this.peers.delete(id)
    return [...this.peers].map(([id, p]) => ({ id, ...p }))
  }

  peerCount(): number {
    return this.peerList().length
  }

  private send(w: Wire) {
    for (const t of this.transports) t.send(w)
  }

  userMsgs(): Msg[] {
    return [...this.log.values()].filter((m) => m.origin === 'user')
  }

  /** Check, verify, dedupe and store a message. Returns true if it was new and valid. */
  async ingest(m: Msg): Promise<boolean> {
    if (!validMsg(m)) {
      this.stats.invalid++
      return false
    }
    if (this.log.has(m.id)) {
      this.stats.duplicates++
      return false
    }
    if (m.hops > MAX_HOPS || m.ttl < 0 || !this.accept(m) || !(await verifyMsg(m))) {
      this.stats.invalid++
      return false
    }
    if (this.log.has(m.id)) return false // arrived twice while verifying
    this.log.set(m.id, m)
    this.stats.accepted++
    if (m.origin === 'user' && Date.now() < this.catchUpUntil && this.lastCatchUp) this.lastCatchUp.n++
    try {
      this.onAccept(m)
    } catch (e) {
      // An application bug must not stop the node from storing and forwarding the message.
      console.error('[lantern] could not apply message', m.id, e)
    }
    return true
  }

  /** Publish a message this node just created to peers. */
  publish(m: Msg) {
    if (m.origin === 'user') this.send({ t: 'msgs', from: this.nodeId, msgs: [m] })
  }

  dropSwarm() {
    for (const [id, m] of this.log) if (m.origin === 'swarm') this.log.delete(id)
  }

  /** Number of my own user messages waiting because no peer is reachable (store-and-forward queue). */
  pendingFor(pub: string): number {
    return this.peerCount() === 0 && !this.transports.some((t) => t.name === 'relay' && t.connected())
      ? this.userMsgs().filter((m) => m.pub === pub).length
      : 0
  }

  private seen(from: string, via: string, extra?: { role?: Role; dev?: string }) {
    const prev = this.peers.get(from)
    this.peers.set(from, { seen: Date.now(), via, role: extra?.role ?? prev?.role, dev: extra?.dev || prev?.dev })
    this.onChange()
  }

  private async onWire(w: Wire, via: string) {
    // Frames are untrusted JSON from any device: check their shape before reading them.
    if (!w || typeof w !== 'object' || typeof w.from !== 'string') return
    if ((w.t === 'inv' || w.t === 'want') && !(Array.isArray(w.ids) && w.ids.every((id) => typeof id === 'string'))) return
    if (w.t === 'msgs' && !Array.isArray(w.msgs)) return
    if (w.from === this.nodeId) return
    if ('to' in w && w.to && w.to !== this.nodeId) return
    if (w.t === 'bye') {
      this.peers.delete(w.from)
      this.onChange()
      return
    }
    if (w.from !== 'relay') this.seen(w.from, via, w.t === 'hello' ? w : undefined)
    switch (w.t) {
      case 'hello': {
        // Replying with our inventory also tells the newcomer we exist.
        this.send({ t: 'inv', from: this.nodeId, to: w.from, ids: this.userMsgs().map((m) => m.id) })
        break
      }
      case 'inv': {
        const missing = w.ids.filter((id) => !this.log.has(id))
        if (missing.length) this.send({ t: 'want', from: this.nodeId, to: w.from, ids: missing })
        break
      }
      case 'want': {
        const msgs = w.ids.map((id) => this.log.get(id)).filter((m): m is Msg => !!m && m.origin === 'user')
        if (msgs.length) this.send({ t: 'msgs', from: this.nodeId, to: w.from, msgs })
        break
      }
      case 'msgs': {
        for (const raw of w.msgs) {
          if (!raw || typeof raw !== 'object' || typeof raw.hops !== 'number' || typeof raw.ttl !== 'number') {
            this.stats.invalid++
            continue
          }
          const m: Msg = { ...raw, origin: 'user', hops: raw.hops + 1, ttl: raw.ttl - 1 }
          if ((await this.ingest(m)) && m.ttl > 1) {
            this.stats.relayed++
            this.send({ t: 'msgs', from: this.nodeId, msgs: [m] })
          }
        }
        this.onChange()
        break
      }
    }
  }
}
