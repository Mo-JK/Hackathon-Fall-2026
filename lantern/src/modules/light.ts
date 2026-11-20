/**
 * Problem 11: what a life without sunlight does to people.
 * Residents send an anonymous 3-tap pulse (hours slept, mood 1-5, minutes under bright light).
 * Lantern shows it per level, measures how wellbeing falls with depth, and proposes a rota for
 * scarce full-spectrum lamp hours, by the same need-weighted fairness rule as power.
 */
import type { Block, RecOf } from '../types'
import { maxMinFair } from '../engine/allocation'
import { K_ANON } from './privacy'

/** Minutes of bright light per day a person should get. */
export const LIGHT_TARGET = 60

export interface PulseRow {
  level: number
  n: number
  reporters: number
  sleep: number
  mood: number
  light: number
  hidden: boolean
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

export function pulseByLevel(recs: RecOf<'pulse'>[], levels: number[]): PulseRow[] {
  const level = (id: string) => Number(id.slice(1, id.indexOf('-')))
  return levels.map((l) => {
    const mine = recs.filter((r) => level(r.blockId) === l)
    const reporters = new Set(mine.map((r) => r.deviceKey)).size
    return {
      level: l,
      n: mine.length,
      reporters,
      sleep: mean(mine.map((r) => r.data.sleep)),
      mood: mean(mine.map((r) => r.data.mood)),
      light: mean(mine.map((r) => r.data.light)),
      hidden: reporters < K_ANON,
    }
  })
}

/** Pearson correlation of depth (level) with a measure, over visible rows. */
export function depthCorrelation(rows: PulseRow[], key: 'sleep' | 'mood' | 'light'): number {
  const vis = rows.filter((r) => !r.hidden)
  if (vis.length < 3) return 0
  const xs = vis.map((r) => r.level)
  const ys = vis.map((r) => r[key])
  const mx = mean(xs)
  const my = mean(ys)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    dx += (xs[i] - mx) ** 2
    dy += (ys[i] - my) ** 2
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

export interface LampRow {
  level: number
  deficit: number
  need: number
  hours: number
}

/** Split `lampHours` across levels by population x light deficit (max-min fair). */
export function lampRota(blocks: Block[], rows: PulseRow[], lampHours: number): LampRow[] {
  const pop = new Map<number, number>()
  for (const b of blocks) pop.set(b.level, (pop.get(b.level) ?? 0) + b.population)
  const vis = rows.filter((r) => !r.hidden)
  const deficits = vis.map((r) => Math.max(0, LIGHT_TARGET - r.light) / LIGHT_TARGET)
  const needs = vis.map((r, i) => ((pop.get(r.level) ?? 0) / 1000) * deficits[i])
  const alloc = maxMinFair(needs, Math.min(lampHours, needs.reduce((s, n) => s + n, 0)))
  // Anything left over once every need is met goes unused rather than to the already-lit.
  return vis.map((r, i) => ({ level: r.level, deficit: deficits[i], need: needs[i], hours: alloc[i] }))
}
