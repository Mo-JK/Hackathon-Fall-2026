import type { Block, Kind, ReportType } from '../types'
import { gauss, poisson, rngFor } from './rng'
import { moduleTraffic } from './hollow'
import type { ModuleTraffic } from './hollow'
import { wetBulb } from '../modules/heat'

export const LEVELS = 12
export const BLOCKS_PER_LEVEL = 4
export const TICK_MINUTES = 10
export const TOTAL_TICKS = 144 // 24 simulated hours
export const KINDS: Kind[] = ['power', 'water', 'temp', 'air']

export interface KindInfo {
  label: string
  unit: string
  critical: number
  /** +1: danger when value rises past critical. -1: danger when it falls below. */
  dir: 1 | -1
  /** Smallest trend (units per tick) worth warning about. */
  minSlope: number
  digits: number
}

export const KIND_INFO: Record<Kind, KindInfo> = {
  power: { label: 'Power', unit: '%', critical: 50, dir: -1, minSlope: 0.8, digits: 0 },
  water: { label: 'Water TDS', unit: ' ppm', critical: 600, dir: 1, minSlope: 4, digits: 0 },
  temp: { label: 'Heat', unit: ' °C', critical: 38, dir: 1, minSlope: 0.12, digits: 1 },
  air: { label: 'Air', unit: ' AQI', critical: 150, dir: 1, minSlope: 1.5, digits: 0 },
}

export const isBeyond = (kind: Kind, value: number) =>
  KIND_INFO[kind].dir === 1 ? value >= KIND_INFO[kind].critical : value <= KIND_INFO[kind].critical

export const blockId = (level: number, index: number) => `L${level}-B${index + 1}`

export function makeBlocks(): Block[] {
  const blocks: Block[] = []
  for (let level = 1; level <= LEVELS; level++) {
    for (let index = 0; index < BLOCKS_PER_LEVEL; index++) {
      blocks.push({
        id: blockId(level, index),
        level,
        index,
        name: `Level ${level}, Block ${index + 1}`,
        population: 6000 + level * 900 + index * 350,
        hardship: Number((1 + (level - 1) * 0.12).toFixed(2)),
        hasSensor: !(level >= 5 && index === 3),
      })
    }
  }
  return blocks
}

/** Same-level ring neighbours plus the blocks directly above and below. */
export function neighborsOf(b: { level: number; index: number }): string[] {
  const out = [
    blockId(b.level, (b.index + 1) % BLOCKS_PER_LEVEL),
    blockId(b.level, (b.index + BLOCKS_PER_LEVEL - 1) % BLOCKS_PER_LEVEL),
  ]
  if (b.level > 1) out.push(blockId(b.level - 1, b.index))
  if (b.level < LEVELS) out.push(blockId(b.level + 1, b.index))
  return out
}

export { rngFor } from './rng'

// ---------- scripted events (the "story" of the simulation) ----------
// Outbreak: Level 10, blocks 1-3. Water: Level 11, blocks 2-3. Blackout: Levels 9-12.
// Heat and air degrade once the power cut stops fans. A heat wave builds on Level 12 first.
// Module events (flood on Level 8, farm cut-off on Level 7, SOS calls) live in hollow.ts.

const OUTBREAK_WEIGHTS = [1, 0.8, 0.6, 0]
const OUTBREAK_PEAK = 1200
const WATER_SLOPES = [0, 18, 12, 0]
const WATER_ONSET = 38
export const REPORT_RATE = 0.004 // fraction of active cases that file a report each tick

export const blackoutStart = (level: number) => (level >= 9 ? 62 + (level - 9) * 2 : Infinity)
export const coolingOff = (level: number) => blackoutStart(level) + 14
export const HEATWAVE_LEVEL = 12
export const HEATWAVE_START = 24

export function powerClean(b: Block, t: number): number {
  const base = 98 - (b.level - 1) * 0.5
  const t0 = blackoutStart(b.level)
  return t < t0 ? base : Math.max(3, base - 3.3 * (t - t0))
}

export function tempClean(b: Block, t: number): number {
  const base = 21 + 1.1 * (b.level - 1)
  const c = coolingOff(b.level)
  const wave = b.level === HEATWAVE_LEVEL && t > HEATWAVE_START ? Math.min(6, 0.09 * (t - HEATWAVE_START)) : 0
  return (t > c ? base + 0.45 * (t - c) : base) + wave
}

/** Deep levels are humid; humidity climbs further once the fans stop. */
export function rhClean(b: Block, t: number): number {
  const c = coolingOff(b.level)
  return Math.min(96, 38 + 3.4 * b.level + (t > c ? Math.min(14, 0.5 * (t - c)) : 0))
}

export function airClean(b: Block, t: number): number {
  const base = 35 + 4 * b.level
  const c = coolingOff(b.level)
  return b.level >= 10 && t > c ? base + 3 * (t - c) : base
}

export function waterClean(b: Block, t: number): number {
  const base = 300 + 6 * b.level
  return b.level === 11 ? base + WATER_SLOPES[b.index] * Math.max(0, t - WATER_ONSET) : base
}

export function trueOutbreak(b: Block, t: number): number {
  if (b.level !== 10) return 0
  return (OUTBREAK_PEAK * OUTBREAK_WEIGHTS[b.index]) / (1 + Math.exp(-(t - 48) / 8))
}

export const trueCases = (b: Block, t: number) => b.population * 0.0004 + trueOutbreak(b, t)

// ---------- the Directorate's bulletin ----------

export interface Official {
  tick: number
  cases: number
  maintenanceLevels: number[]
  headline: string
}

export function officialBulletin(tick: number, blocks: Block[]): Official {
  const outbreak = blocks.reduce((s, b) => s + trueOutbreak(b, tick), 0)
  const maintenanceLevels: number[] = []
  for (let level = 9; level <= LEVELS; level++) if (tick >= blackoutStart(level) + 16) maintenanceLevels.push(level)
  return {
    tick,
    cases: 2 + Math.round(0.012 * outbreak),
    maintenanceLevels,
    headline: maintenanceLevels.length
      ? `Scheduled maintenance on Levels ${maintenanceLevels[0]}-${LEVELS}. No cause for concern.`
      : 'All systems normal. Remain calm.',
  }
}

// ---------- one tick of the world ----------

export interface SimTelemetry {
  blockId: string
  ts: number
  power: number
  water: number
  temp: number
  air: number
  rh: number
}
export interface SimReport {
  blockId: string
  type: ReportType
  ts: number
  /** Which of the block's resident devices filed it. */
  slot: number
}
export interface SimCheckin {
  blockId: string
  phrase: string
  ts: number
}
export interface SimOutput {
  tick: number
  telemetry: SimTelemetry[]
  reports: SimReport[]
  checkins: SimCheckin[]
  mod: ModuleTraffic
}

export const RESIDENT_DEVICES_PER_BLOCK = 5
export const FAMILY_PHRASE = 'blue-heron-7'
export const FAMILY_CHECKIN_TICK = 88
export const FAMILY_BLOCK = 'L3-B2'

const r1 = (n: number) => Math.round(n * 10) / 10

export function simulateTick(seed: number, tick: number, blocks: Block[]): SimOutput {
  const telemetry: SimTelemetry[] = []
  const reports: SimReport[] = []
  const checkins: SimCheckin[] = []

  blocks.forEach((b, bi) => {
    if (b.hasSensor) {
      const r = rngFor(seed, tick, bi, 1)
      telemetry.push({
        blockId: b.id,
        ts: tick,
        power: r1(Math.min(100, powerClean(b, tick) + gauss(r) * 1.2)),
        water: r1(waterClean(b, tick) + gauss(r) * 8),
        temp: r1(tempClean(b, tick) + gauss(r) * 0.3),
        air: r1(airClean(b, tick) + gauss(r) * 3),
        rh: Math.round(rhClean(b, tick) + gauss(rngFor(seed, tick, bi, 9)) * 1.5),
      })
    }
    const p = powerClean(b, tick)
    const w = waterClean(b, tick)
    const streams: [ReportType, number, number][] = [
      ['outage', 2, p < 85 ? 0.15 + (0.8 * (85 - Math.max(p, 5))) / 80 : 0.02],
      ['water_taste', 3, w > 420 ? 0.4 + (w - 420) / 250 : 0.02],
      ['symptom', 4, trueCases(b, tick) * REPORT_RATE],
    ]
    for (const [type, stream, lambda] of streams) {
      const r = rngFor(seed, tick, bi, stream)
      const n = poisson(r, lambda)
      for (let i = 0; i < n; i++) {
        reports.push({ blockId: b.id, type, ts: tick, slot: Math.floor(r() * RESIDENT_DEVICES_PER_BLOCK) })
      }
    }
  })

  if (tick === FAMILY_CHECKIN_TICK) checkins.push({ blockId: FAMILY_BLOCK, phrase: FAMILY_PHRASE, ts: tick })

  const symptoms = new Map<string, number>()
  for (const r of reports) if (r.type === 'symptom') symptoms.set(r.blockId, (symptoms.get(r.blockId) ?? 0) + 1)
  const mod = moduleTraffic(
    seed,
    tick,
    blocks,
    symptoms,
    (b) => powerClean(b, tick) < 50,
    (b) => wetBulb(tempClean(b, tick), rhClean(b, tick)) >= 31,
    RESIDENT_DEVICES_PER_BLOCK,
  )
  return { tick, telemetry, reports, checkins, mod }
}
