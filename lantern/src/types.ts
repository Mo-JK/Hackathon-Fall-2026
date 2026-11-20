export type Kind = 'power' | 'water' | 'temp' | 'air'
export type ReportType = 'symptom' | 'water_taste' | 'outage'
export type Resource = 'power' | 'water' | 'food'

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

export type MsgData =
  | { k: 'telemetry'; power: number; water: number; temp: number; air: number }
  | { k: 'report'; type: ReportType }
  | { k: 'checkin'; codeHash: string }

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
