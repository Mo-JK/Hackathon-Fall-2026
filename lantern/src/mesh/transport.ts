import type { Msg } from '../types'

/** What gossip nodes say to each other. Every transport carries the same frames. */
export type Wire =
  | { t: 'hello'; from: string; role?: Role; dev?: string }
  | { t: 'bye'; from: string }
  | { t: 'inv'; from: string; to: string; ids: string[] }
  | { t: 'want'; from: string; to: string; ids: string[] }
  | { t: 'msgs'; from: string; to?: string; msgs: Msg[] }

export type Role = 'laptop' | 'phone'

/**
 * A way to move frames between devices. Gossip does not know or care which one it is using:
 * production would add BLE / LoRa / Wi-Fi Direct here and nothing above this line changes.
 */
export interface Transport {
  readonly name: string
  /** Called with every frame received, and once each time the link (re)connects. */
  start(onWire: (w: Wire) => void, onConnect: () => void, onStatus: () => void): void
  send(w: Wire): void
  stop(): void
  connected(): boolean
}

/** Tabs on the same device. */
export class BroadcastTransport implements Transport {
  readonly name = 'tab'
  private chan: BroadcastChannel | null = null

  start(onWire: (w: Wire) => void, onConnect: () => void) {
    if (typeof BroadcastChannel === 'undefined' || this.chan) return
    this.chan = new BroadcastChannel('lantern-mesh')
    this.chan.onmessage = (e: MessageEvent<Wire>) => onWire(e.data)
    onConnect()
  }
  send(w: Wire) {
    this.chan?.postMessage(w)
  }
  stop() {
    this.chan?.close()
    this.chan = null
  }
  connected() {
    return !!this.chan
  }
}

/**
 * The community relay over the laptop's hotspot (see relay/server.mjs). It stands in for a LoRa
 * repeater: it forwards signed envelopes and never verifies or trusts them. Reconnects forever,
 * so pulling the relay's plug and putting it back is survivable.
 */
export class SocketTransport implements Transport {
  readonly name = 'relay'
  private ws: WebSocket | null = null
  private stopped = false
  private retry = 800
  private timer: ReturnType<typeof setTimeout> | null = null
  private handlers: { onWire: (w: Wire) => void; onConnect: () => void; onStatus: () => void } | null = null

  constructor(readonly url: string) {}

  start(onWire: (w: Wire) => void, onConnect: () => void, onStatus: () => void) {
    this.handlers = { onWire, onConnect, onStatus }
    this.stopped = false
    this.open()
  }

  private open() {
    if (this.stopped || typeof WebSocket === 'undefined') return
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      this.later()
      return
    }
    this.ws = ws
    ws.onopen = () => {
      this.retry = 800
      this.handlers?.onStatus()
      this.handlers?.onConnect()
    }
    ws.onmessage = (e) => {
      try {
        this.handlers?.onWire(JSON.parse(String(e.data)) as Wire)
      } catch {
        /* not a frame */
      }
    }
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null
      this.handlers?.onStatus()
      this.later()
    }
    ws.onerror = () => ws.close()
  }

  private later() {
    if (this.stopped || this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.open()
    }, this.retry)
    this.retry = Math.min(5000, this.retry * 1.6)
  }

  send(w: Wire) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(w))
  }

  stop() {
    this.stopped = true
    if (this.timer) clearTimeout(this.timer)
    this.ws?.close()
    this.ws = null
  }

  connected() {
    return this.ws?.readyState === 1
  }
}

/** In-memory hub for tests: every transport attached to it hears every other one. */
export class MemoryHub {
  private members = new Set<MemoryTransport>()
  attach(t: MemoryTransport) {
    this.members.add(t)
  }
  detach(t: MemoryTransport) {
    this.members.delete(t)
  }
  deliver(from: MemoryTransport, w: Wire) {
    const copy = JSON.parse(JSON.stringify(w)) as Wire
    for (const m of this.members) if (m !== from) m.receive(copy)
  }
}

export class MemoryTransport implements Transport {
  readonly name = 'memory'
  private onWire: ((w: Wire) => void) | null = null
  private up = false
  constructor(private hub: MemoryHub) {}
  start(onWire: (w: Wire) => void, onConnect: () => void) {
    this.onWire = onWire
    this.up = true
    this.hub.attach(this)
    onConnect()
  }
  receive(w: Wire) {
    if (this.up) this.onWire?.(w)
  }
  send(w: Wire) {
    if (this.up) this.hub.deliver(this, w)
  }
  stop() {
    this.up = false
    this.hub.detach(this)
  }
  connected() {
    return this.up
  }
}
