export type Kind = 'power' | 'water' | 'temp' | 'air'
export type ReportType = 'symptom' | 'water_taste' | 'outage'
export type Resource = 'power' | 'water' | 'food'
export type SosNeed = 'medical' | 'trapped' | 'water' | 'heat'
export type TriageOutcome = 'self' | 'medicine' | 'clinic'
export type SpaceWhat = 'sleep' | 'quiet' | 'cool'

export interface Block {
  id: string
  level: number
  index: number
  name: string
  population: number
  /** Multiplier on baseline need: deeper levels are hotter, darker and sicker. */
  hardship: number
  /** Blocks without a sensor rely on human reports only. */
  hasSensor: boolean
}

export interface Telemetry {
  blockId: string
  ts: number
  power: number
  water: number
  temp: number
  air: number
  /** Relative humidity, %. Feeds the heat-stress (wet-bulb) module. */
  rh: number
  deviceKey: string
}

export interface Report {
  id: string
  blockId: string
  type: ReportType
  ts: number
  deviceKey: string
}

export interface Checkin {
  id: string
  blockId: string
  wall: number
  deviceKey: string
  codeHash: string
  mine: boolean
  /** True when injected by the simulator rather than a real peer or the user. */
  virtual: boolean
}

export interface ProbeData {
  k: 'probe'
  probe: string
  seq: number
  day: number
  /** Hash of the previous entry in this probe's chain ('' for the first). */
  prev: string
  aqi: number
  o2: number
  rad: number
  tempC: number
}

export type MsgData =
  | { k: 'telemetry'; power: number; water: number; temp: number; air: number; rh: number }
  | { k: 'report'; type: ReportType }
  | { k: 'checkin'; codeHash: string }
  | { k: 'sos'; need: SosNeed }
  /** An established device vouches, in person, for another device's public key. */
  | { k: 'vouch'; target: string }
  /** Water-level gauge on a tunnel segment ("L8-B1|L8-B2"), depth in cm. */
  | { k: 'gauge'; edge: string; depth: number }
  /** Anonymous daily wellbeing pulse: hours slept, mood 1-5, minutes under bright light. */
  | { k: 'pulse'; sleep: number; mood: number; light: number }
  /** Only the triage outcome is shared, never the symptoms. */
  | { k: 'triage'; outcome: TriageOutcome }
  | { k: 'space'; mode: 'offer' | 'request'; what: SpaceWhat; slots: number }
  /** Food ledger entry: a grow plot (ready at a tick) or the communal pantry (crop 'pantry'). */
  | { k: 'plot'; crop: string; kg: number; ready: number }
  | ProbeData

export type MsgKind = MsgData['k']

/** The signed part of a message. hops/ttl/origin change in transit and are not signed. */
export interface MsgBody {
  id: string
  blockId: string
  /** Simulated time (tick) for sensor/report data. */
  ts: number
  /** Wall-clock ms, used for check-ins. */
  wall: number
  data: MsgData
}

export interface Msg extends MsgBody {
  /** Sender public key, hex (raw P-256). */
  pub: string
  sig: string
  hops: number
  ttl: number
  origin: 'swarm' | 'user'
}

/** A verified message as the engines see it: who sent it, where, when, and its data. */
export interface Rec<D extends MsgData = MsgData> {
  id: string
  blockId: string
  ts: number
  wall: number
  deviceKey: string
  pub: string
  mine: boolean
  virtual: boolean
  data: D
}

export type RecOf<K extends MsgKind> = Rec<Extract<MsgData, { k: K }>>
