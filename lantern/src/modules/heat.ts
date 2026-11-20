/**
 * Problem 3: keep the hot deep levels livable.
 * Heat stress is judged by wet-bulb temperature (heat plus humidity), not air temperature alone:
 * above ~31 °C wet-bulb, hard work becomes dangerous; around 35 °C the body cannot cool itself.
 */
import type { Block } from '../types'
import { maxMinFair } from '../engine/allocation'

export const TW_SAFE = 28
export const TW_DANGER = 31
export const TW_EXTREME = 35
/** Wet-bulb below which no cooling is needed. */
const TW_COMFORT = 26

/** Stull (2011) wet-bulb approximation; valid for 5-99% RH and -20..50 °C. Inputs: °C, %RH. */
export function wetBulb(t: number, rh: number): number {
  return (
    t * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(t + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  )
}

export type HeatRisk = 'ok' | 'danger' | 'extreme'

export interface HeatRow {
  blockId: string
  level: number
  temp: number
  rh: number
  tw: number
  risk: HeatRisk
  population: number
}

export const riskOf = (tw: number): HeatRisk => (tw >= TW_EXTREME ? 'extreme' : tw >= TW_DANGER ? 'danger' : 'ok')

export function heatRows(blocks: Block[], latest: Map<string, { temp: number; rh: number }>): HeatRow[] {
  const out: HeatRow[] = []
  for (const b of blocks) {
    const t = latest.get(b.id)
    if (!t) continue
    const tw = wetBulb(t.temp, t.rh)
    out.push({ blockId: b.id, level: b.level, temp: t.temp, rh: t.rh, tw, risk: riskOf(tw), population: b.population })
  }
  return out
}

export interface FanRow {
  blockId: string
  need: number
  alloc: number
  coverage: number
}

/**
 * Spread a limited fan-power budget by heat risk x population, using the same need-weighted
 * max-min rule as the power allocation. `budget` is a fraction of the total cooling need.
 */
export function scheduleFans(rows: HeatRow[], budget: number): FanRow[] {
  const needs = rows.map((r) => r.population * Math.max(0, r.tw - TW_COMFORT))
  const total = needs.reduce((s, n) => s + n, 0)
  const alloc = maxMinFair(needs, total * budget)
  return rows
    .map((r, i) => ({ blockId: r.blockId, need: needs[i], alloc: alloc[i], coverage: needs[i] ? alloc[i] / needs[i] : 1 }))
    .filter((f) => f.need > 0)
}

/** Blocks cool enough to shelter in, and still powered. */
export function coolRefuges(rows: HeatRow[], powered: (blockId: string) => boolean): string[] {
  return rows.filter((r) => r.tw < TW_SAFE && powered(r.blockId)).map((r) => r.blockId)
}
