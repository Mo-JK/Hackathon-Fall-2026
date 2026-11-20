/**
 * The simulated Hollow beyond the core sensors: tunnels, clinics, flood gauges, food,
 * crowding, wellbeing, the surface probes and the volunteers. Everything here is scripted
 * and deterministic (seeded) so the demo tells the same story every run.
 */
import type { Block, SosNeed, SpaceWhat, TriageOutcome } from '../types'
import { gauss, poisson, rngFor } from './rng'

// Kept in sync with world.ts (not imported, to avoid a cycle: world.ts imports this file).
const LEVELS = 12
const BLOCKS_PER_LEVEL = 4
const blockId = (level: number, index: number) => `L${level}-B${index + 1}`

// ---------- tunnel geography ----------

export interface Edge {
  id: string
  a: string
  b: string
  /** Metres. */
  length: number
  kind: 'ring' | 'shaft'
}

export const edgeId = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** Each level is a ring of 4 blocks; stairs link each block to the one directly above and below. */
export function makeEdges(): Edge[] {
  const out: Edge[] = []
  for (let level = 1; level <= LEVELS; level++) {
    for (let i = 0; i < BLOCKS_PER_LEVEL; i++) {
      const a = blockId(level, i)
      const ring = blockId(level, (i + 1) % BLOCKS_PER_LEVEL)
      out.push({ id: edgeId(a, ring), a, b: ring, length: 400, kind: 'ring' })
      if (level < LEVELS) {
        const down = blockId(level + 1, i)
        out.push({ id: edgeId(a, down), a, b: down, length: 250, kind: 'shaft' })
      }
    }
  }
  return out
}

export const CLINICS = ['L2-B1', 'L6-B3', 'L11-B4']
export const WATER_POINTS = ['L1-B3', 'L4-B2', 'L8-B4', 'L12-B1']

// ---------- flooding (problem 5) ----------

export const FLOOD_CLOSED_CM = 30
/** Sewage backs up on Level 8 and spreads; the stairs down to L9-B2 go last. */
export const FLOOD_START: Record<string, number> = {
  'L8-B1|L8-B2': 92,
  'L8-B2|L8-B3': 96,
  'L8-B2|L9-B2': 100,
}
export const GAUGED_EDGES = ['L8-B1|L8-B2', 'L8-B2|L8-B3', 'L8-B2|L9-B2', 'L8-B3|L9-B3', 'L5-B1|L5-B2']

export function floodDepth(edge: string, t: number): number {
  const start = FLOOD_START[edge]
  return 3 + (start === undefined ? 0 : Math.min(120, Math.max(0, 7 * (t - start))))
}

// ---------- crowding (problem 6) ----------

/** Rooms per block shrink relative to people the deeper you go. */
export const roomsOf = (b: Block) => Math.round(b.population / (1.6 + 0.22 * b.level))

// ---------- food (problem 12) ----------

export const DAILY_KG = 0.6
export const FARM_CUTOFF_TICK = 60
export const FARM_CUTOFF_LEVEL = 7
const CROPS = ['lamp potatoes', 'mushrooms', 'duckweed', 'beans', 'kale']

export function pantryKg(b: Block): number {
  const days = 2.2 + 0.4 * b.index + (LEVELS - b.level) * 0.12
  return Math.round(b.population * DAILY_KG * days * (b.level === FARM_CUTOFF_LEVEL ? 0.55 : 1))
}

// ---------- surface probes (problem 13) ----------

export const PROBE_DAYS = 41
export const READINGS_PER_DAY = 4
export interface ProbeSpec {
  id: string
  name: string
  aqi: [number, number]
  o2: [number, number]
}
export const PROBES: ProbeSpec[] = [
  { id: 'A', name: 'Shaft A (old freight lift)', aqi: [138, 52], o2: [20.2, 20.7] },
  { id: 'B', name: 'Shaft B (ventilation stack)', aqi: [160, 64], o2: [20.0, 20.5] },
  { id: 'C', name: 'Shaft C (near machine yard)', aqi: [205, 186], o2: [19.6, 19.8] },
]

export interface ProbeReading {
  probe: string
  seq: number
  day: number
  aqi: number
  o2: number
  rad: number
  tempC: number
}

export function probeHistory(seed: number): ProbeReading[] {
  const out: ProbeReading[] = []
  PROBES.forEach((p, pi) => {
    for (let d = 1; d <= PROBE_DAYS; d++) {
      for (let k = 0; k < READINGS_PER_DAY; k++) {
        const r = rngFor(seed, 900 + pi, d, k)
        const f = d / PROBE_DAYS
        const seq = (d - 1) * READINGS_PER_DAY + k
        out.push({
          probe: p.id,
          seq,
          day: d,
          aqi: Math.round(p.aqi[0] + (p.aqi[1] - p.aqi[0]) * f + gauss(r) * 7),
          o2: round2(p.o2[0] + (p.o2[1] - p.o2[0]) * f + gauss(r) * 0.05),
          rad: round2(0.22 + 0.06 * pi + gauss(r) * 0.02),
          tempC: Math.round((12 + 7 * Math.sin((k / READINGS_PER_DAY) * 2 * Math.PI) + gauss(r)) * 10) / 10,
        })
      }
    }
  })
  return out
}

// ---------- the way up (problems 14, 15) ----------

export interface Volunteer {
  id: string
  level: number
  consent: boolean
  /** 0-1, from a self-reported checklist. */
  health: number
  skills: string[]
  /** 0-1, how much risk they say they accept. */
  riskAccept: number
}

export const SKILLS = ['engineer', 'medic', 'farmer', 'sensor-tech', 'builder']

export function volunteers(seed: number): Volunteer[] {
  return Array.from({ length: 24 }, (_, i) => {
    const r = rngFor(seed, 700, i)
    const skills = SKILLS.filter(() => r() < 0.3)
    return {
      id: `V-${String(i + 1).padStart(2, '0')}`,
      level: 1 + Math.floor(r() * LEVELS),
      consent: r() < 0.8,
      health: round2(0.45 + r() * 0.55),
      skills: skills.length ? skills : [SKILLS[i % SKILLS.length]],
      riskAccept: round2(r()),
    }
  })
}

export interface Shaft {
  id: string
  name: string
  levels: number[]
  /** People per day it can lift. */
  capPerDay: number
}

export const SHAFTS: Shaft[] = [
  { id: 'A', name: 'Shaft A', levels: [1, 2, 3, 4, 5, 6], capPerDay: 9000 },
  { id: 'B', name: 'Shaft B', levels: [4, 5, 6, 7, 8, 9, 10, 11, 12], capPerDay: 7000 },
  { id: 'C', name: 'Shaft C', levels: [7, 8, 9, 10, 11, 12], capPerDay: 6000 },
]

// ---------- per-tick resident traffic for the modules ----------

export interface SimPulse {
  blockId: string
  slot: number
  sleep: number
  mood: number
  light: number
}
export interface SimTriage {
  blockId: string
  slot: number
  outcome: TriageOutcome
}
export interface SimSpace {
  blockId: string
  slot: number
  mode: 'offer' | 'request'
  what: SpaceWhat
  slots: number
}
export interface SimPlot {
  blockId: string
  slot: number
  crop: string
  kg: number
  ready: number
}
export interface SimSos {
  blockId: string
  slot: number
  need: SosNeed
}
export interface SimGauge {
  edge: string
  depth: number
}

export const SCRIPTED_SOS: { tick: number; blockId: string; need: SosNeed }[] = [
  { tick: 82, blockId: 'L10-B3', need: 'trapped' },
  { tick: 90, blockId: 'L12-B2', need: 'heat' },
  { tick: 95, blockId: 'L11-B2', need: 'water' },
  { tick: 101, blockId: 'L9-B4', need: 'medical' },
]

export const TICKS_PER_DAY = 144

export interface ModuleTraffic {
  gauges: SimGauge[]
  pulses: SimPulse[]
  triages: SimTriage[]
  spaces: SimSpace[]
  plots: SimPlot[]
  sos: SimSos[]
}

export function moduleTraffic(
  seed: number,
  tick: number,
  blocks: Block[],
  symptomsByBlock: Map<string, number>,
  dark: (b: Block) => boolean,
  hot: (b: Block) => boolean,
  slots: number,
): ModuleTraffic {
  const out: ModuleTraffic = { gauges: [], pulses: [], triages: [], spaces: [], plots: [], sos: [] }

  if (tick % 2 === 0) {
    GAUGED_EDGES.forEach((edge, ei) => {
      const r = rngFor(seed, tick, 500 + ei)
      out.gauges.push({ edge, depth: Math.max(0, Math.round(floodDepth(edge, tick) + gauss(r) * 1.5)) })
    })
  }

  blocks.forEach((b, bi) => {
    const r = rngFor(seed, tick, bi, 40)
    const pick = () => Math.floor(r() * slots)
    const isDark = dark(b)
    const isHot = hot(b)

    for (let i = poisson(r, 0.3); i > 0; i--) {
      out.pulses.push({
        blockId: b.id,
        slot: pick(),
        sleep: round1(clamp(7.4 - 0.12 * b.level - (isDark ? 0.9 : 0) - (isHot ? 0.6 : 0) + gauss(r) * 0.6, 2, 10)),
        mood: Math.round(clamp(4.3 - 0.13 * b.level - (isDark ? 0.5 : 0) + gauss(r) * 0.6, 1, 5)),
        light: Math.round(clamp((95 - 7.5 * b.level) * (isDark ? 0.4 : 1) + gauss(r) * 8, 0, 120)),
      })
    }

    const symptoms = symptomsByBlock.get(b.id) ?? 0
    for (let i = 0; i < symptoms; i++) {
      if (r() < 0.55) {
        const x = r()
        out.triages.push({ blockId: b.id, slot: pick(), outcome: x < 0.12 ? 'clinic' : x < 0.6 ? 'medicine' : 'self' })
      }
    }

    if (r() < (b.level <= 4 ? 0.07 : 0.015)) {
      out.spaces.push({ blockId: b.id, slot: pick(), mode: 'offer', what: r() < 0.25 ? 'cool' : r() < 0.7 ? 'sleep' : 'quiet', slots: 1 + Math.floor(r() * 4) })
    }
    if (r() < 0.02 + 0.008 * b.level + (isHot ? 0.06 : 0)) {
      out.spaces.push({ blockId: b.id, slot: pick(), mode: 'request', what: isHot ? 'cool' : r() < 0.7 ? 'sleep' : 'quiet', slots: 1 + Math.floor(r() * 3) })
    }

    // The food ledger: each block logs its pantry once, then its grow plots.
    if (tick === 2 + b.index) {
      out.plots.push({ blockId: b.id, slot: 0, crop: 'pantry', kg: pantryKg(b), ready: 0 })
      const plots = 1 + Math.floor(r() * 2)
      for (let p = 0; p < plots; p++) {
        out.plots.push({
          blockId: b.id,
          slot: 1 + p,
          crop: CROPS[(bi + p) % CROPS.length],
          kg: Math.round(b.population * DAILY_KG * (0.6 + r() * 1.8)),
          ready: tick + Math.round((2 + r() * 9) * TICKS_PER_DAY),
        })
      }
    }
  })

  for (const s of SCRIPTED_SOS) if (s.tick === tick) out.sos.push({ blockId: s.blockId, slot: 1, need: s.need })
  return out
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const round1 = (v: number) => Math.round(v * 10) / 10
const round2 = (v: number) => Math.round(v * 100) / 100
