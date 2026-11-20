/**
 * Runs every module engine over the current shared truth. Pure apart from small caches for
 * the two engines whose inputs rarely change (probe assessment and the return plan).
 */
import type { Block, RecOf, Telemetry } from '../types'
import type { BlockTruth } from '../engine/trust'
import type { Edge, Volunteer } from '../sim/hollow'
import { CLINICS, FARM_CUTOFF_LEVEL, FARM_CUTOFF_TICK, PROBES, SHAFTS, WATER_POINTS } from '../sim/hollow'
import { LEVELS } from '../sim/world'
import type { HeatRow } from './heat'
import { coolRefuges, heatRows, TW_DANGER, TW_EXTREME } from './heat'
import type { FloodState, Hazards, Route } from './routes'
import { floodState, routeTo } from './routes'
import type { CrowdRow, SpaceResult } from './space'
import { crowding, matchSpace } from './space'
import type { CareRow } from './care'
import { careTable, medicineDemand } from './care'
import type { PulseRow } from './light'
import { depthCorrelation, pulseByLevel } from './light'
import type { FoodRow, Transfer } from './food'
import { balanceDistrict, foodTable, ledgers } from './food'
import type { Assessment, ChainCheck, CohortPick, OptionRow, ProbeMsg } from './surface'
import { assess, rankCohort, shaftOpen, surfaceOptions } from './surface'
import type { Plan } from './returnplan'
import { planReturn } from './returnplan'

export type RouteTarget = 'clinic' | 'water' | 'cool' | 'family'

export interface ModuleInput {
  blocks: Block[]
  edges: Edge[]
  now: number
  latest: Map<string, Telemetry>
  truth: Map<string, BlockTruth>
  recs: {
    sos: RecOf<'sos'>[]
    gauge: RecOf<'gauge'>[]
    pulse: RecOf<'pulse'>[]
    triage: RecOf<'triage'>[]
    space: RecOf<'space'>[]
    plot: RecOf<'plot'>[]
  }
  home: string
  routeTarget: RouteTarget
  familyBlock: string | null
  probes: ProbeMsg[]
  chain: Map<string, ChainCheck | null>
  volunteers: Volunteer[]
}

export interface ModuleSnapshot {
  heat: { rows: HeatRow[]; refuges: string[]; danger: number; extreme: number; peopleAtRisk: number }
  flood: FloodState
  hazards: Hazards
  route: { target: RouteTarget; to: string[]; route: Route | null }
  /** Route from home to the nearest clinic, regardless of the selected target (care panel). */
  clinicRoute: Route | null
  sos: RecOf<'sos'>[]
  space: { crowd: CrowdRow[]; result: SpaceResult; offers: number; requests: number }
  care: { rows: CareRow[]; demand: { blockId: string; courses: number }[]; hiddenBlocks: number }
  light: { rows: PulseRow[]; corrMood: number; corrLight: number; pulses: number }
  food: { rows: FoodRow[]; cutOff: boolean; balance: { transfers: Transfer[]; before: number; after: number } }
  surface: { assessments: Assessment[]; verified: Map<string, boolean | null>; best: Assessment | null; options: OptionRow[] }
  cohort: { picks: CohortPick[]; eligible: number; declined: number }
  ret: { open: string[]; fair: Plan; upper: Plan; levels: { level: number; people: number; hardship: number }[] }
}

const levelOf = (id: string) => Number(id.slice(1, id.indexOf('-')))

let assessCache: { key: string; value: Assessment[] } | null = null
let planCache: { key: string; fair: Plan; upper: Plan } | null = null

export function computeModules(inp: ModuleInput): ModuleSnapshot {
  const { blocks, edges } = inp

  // ---- heat (3)
  const rows = heatRows(blocks, inp.latest)
  const powered = (id: string) => !inp.truth.get(id)?.flaggedKinds.includes('power')
  const refuges = coolRefuges(rows, powered)
  const atRisk = rows.filter((r) => r.risk !== 'ok')

  // ---- hazards + flood + routes (5, 8, 10)
  const flood = floodState(inp.recs.gauge, edges)
  const blockCost = new Map<string, number>()
  for (const b of blocks) {
    let c = 1
    if (!powered(b.id)) c = Math.max(c, 1.5)
    const h = rows.find((r) => r.blockId === b.id)
    if (h && h.tw >= TW_EXTREME) c = Math.max(c, 3)
    else if (h && h.tw >= TW_DANGER) c = Math.max(c, 2)
    blockCost.set(b.id, c)
  }
  const hazards: Hazards = { closed: flood.closed, blockCost }
  const safeWater = WATER_POINTS.filter((id) => (inp.latest.get(id)?.water ?? 0) < 450)
  const targets: Record<RouteTarget, string[]> = {
    clinic: CLINICS,
    water: safeWater,
    cool: refuges.filter((id) => id !== inp.home),
    family: inp.familyBlock ? [inp.familyBlock] : [],
  }
  const route = routeTo(edges, inp.home, targets[inp.routeTarget], hazards)
  const clinicRoute = routeTo(edges, inp.home, CLINICS, hazards)

  // ---- SOS (7): newest call per block
  const sosByBlock = new Map<string, RecOf<'sos'>>()
  for (const s of inp.recs.sos) if (!sosByBlock.has(s.blockId) || sosByBlock.get(s.blockId)!.ts <= s.ts) sosByBlock.set(s.blockId, s)

  // ---- space (6)
  const offers = inp.recs.space.filter((s) => s.data.mode === 'offer')
  const requests = inp.recs.space.filter((s) => s.data.mode === 'request')
  const heatDanger = (id: string) => (rows.find((r) => r.blockId === id)?.tw ?? 0) >= TW_DANGER
  const space = { crowd: crowding(blocks), result: matchSpace(offers, requests, blocks, edges, heatDanger), offers: offers.length, requests: requests.length }

  // ---- care (9, 10)
  const careRows = careTable(inp.recs.triage, blocks)

  // ---- light (11)
  const levels = Array.from({ length: LEVELS }, (_, i) => i + 1)
  const pulseRows = pulseByLevel(inp.recs.pulse, levels)

  // ---- food (12)
  const foodRows = foodTable(blocks, ledgers(inp.recs.plot), inp.now)

  // ---- surface (13, 14)
  const key = inp.probes.map((p) => `${p.id}:${p.data.aqi}`).join(',')
  if (!assessCache || assessCache.key !== key) {
    assessCache = { key, value: PROBES.map((p) => assess(p.id, inp.probes.filter((m) => m.data.probe === p.id).map((m) => m.data))) }
  }
  const assessments = assessCache.value
  const verified = new Map(PROBES.map((p) => [p.id, inp.chain.get(p.id) ? inp.chain.get(p.id)!.firstBad === -1 : null]))
  const trusted = assessments.filter((a) => verified.get(a.probe) === true && a.verdict !== 'no-evidence')
  const best = trusted.length ? trusted.reduce((a, b) => (a.last7 <= b.last7 ? a : b)) : null

  // ---- return (15)
  const open = SHAFTS.filter((s) => shaftOpen(assessments.find((a) => a.probe === s.id), verified.get(s.id) === true)).map((s) => s.id)
  const levelPops = levels.map((l) => {
    const bs = blocks.filter((b) => b.level === l)
    return { level: l, people: bs.reduce((s, b) => s + b.population, 0), hardship: bs[0]?.hardship ?? 1 }
  })
  const pkey = open.join()
  if (!planCache || planCache.key !== pkey) {
    const shafts = SHAFTS.filter((s) => open.includes(s.id))
    planCache = { key: pkey, fair: planReturn(levelPops, shafts, 'fair'), upper: planReturn(levelPops, shafts, 'upper') }
  }

  return {
    heat: { rows, refuges, danger: atRisk.length, extreme: rows.filter((r) => r.risk === 'extreme').length, peopleAtRisk: atRisk.reduce((s, r) => s + r.population, 0) },
    flood,
    hazards,
    route: { target: inp.routeTarget, to: targets[inp.routeTarget], route },
    clinicRoute,
    sos: [...sosByBlock.values()].sort((a, b) => b.ts - a.ts),
    space,
    care: { rows: careRows, demand: medicineDemand(careRows), hiddenBlocks: careRows.filter((r) => r.hidden).length },
    light: { rows: pulseRows, corrMood: depthCorrelation(pulseRows, 'mood'), corrLight: depthCorrelation(pulseRows, 'light'), pulses: inp.recs.pulse.length },
    food: {
      rows: foodRows,
      cutOff: inp.now >= FARM_CUTOFF_TICK,
      balance: balanceDistrict(foodRows, FARM_CUTOFF_LEVEL),
    },
    surface: { assessments, verified, best, options: surfaceOptions(best ? best.last7 : null) },
    cohort: rankCohort(inp.volunteers),
    ret: { open, fair: planCache.fair, upper: planCache.upper, levels: levelPops },
  }
}

export { levelOf }
