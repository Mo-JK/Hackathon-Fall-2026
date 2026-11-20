import type { Block, Resource } from '../types'

/** Illustrative units per person. */
export const PER_CAPITA: Record<Resource, number> = { power: 1, water: 3, food: 1.5 }
export const RESOURCE_LABEL: Record<Resource, string> = { power: 'Power', water: 'Clean water', food: 'Food' }
const HAZARD_BONUS = 0.25

/** Need grows with depth (hardship) and with each confirmed hazard in the block. */
export function needOf(block: Block, resource: Resource, hazards: number): number {
  return block.population * PER_CAPITA[resource] * block.hardship * (1 + HAZARD_BONUS * Math.min(3, hazards))
}

/** Today's baseline: serve levels top to bottom until the supply runs out. */
export function priorityFill(blocks: Block[], needs: number[], supply: number): number[] {
  const order = blocks.map((_, i) => i).sort((a, b) => blocks[a].level - blocks[b].level || blocks[a].index - blocks[b].index)
  const out = needs.map(() => 0)
  let left = supply
  for (const i of order) {
    const give = Math.min(needs[i], left)
    out[i] = give
    left -= give
  }
  return out
}

/**
 * Need-weighted max-min fairness. Raise every block's coverage (share / need) together
 * until supply runs out or a block is fully served. Because each block is capped at its
 * own need, the water level is uniform: coverage = min(1, supply / total need).
 */
export function maxMinFair(needs: number[], supply: number): number[] {
  const total = needs.reduce((s, n) => s + n, 0)
  const coverage = total === 0 ? 0 : Math.min(1, supply / total)
  return needs.map((n) => n * coverage)
}

export interface Metrics {
  /** Lowest coverage any block gets. */
  minCoverage: number
  /** Population-weighted Gini of coverage; 0 is perfectly equal. */
  gini: number
  blocksBelowHalf: number
  peopleBelowHalf: number
}

export function metricsFor(blocks: Block[], needs: number[], alloc: number[]): Metrics {
  const cov = alloc.map((a, i) => (needs[i] === 0 ? 1 : a / needs[i]))
  const w = blocks.map((b) => b.population)
  const W = w.reduce((s, x) => s + x, 0)
  const mean = cov.reduce((s, c, i) => s + c * w[i], 0) / W
  let diff = 0
  for (let i = 0; i < cov.length; i++) for (let j = 0; j < cov.length; j++) diff += w[i] * w[j] * Math.abs(cov[i] - cov[j])
  return {
    minCoverage: Math.min(...cov),
    gini: mean === 0 ? 0 : diff / (2 * W * W * mean),
    blocksBelowHalf: cov.filter((c) => c < 0.5).length,
    peopleBelowHalf: blocks.reduce((s, b, i) => s + (cov[i] < 0.5 ? b.population : 0), 0),
  }
}

export interface LevelRow {
  level: number
  need: number
  official: number
  fair: number
  officialCoverage: number
  fairCoverage: number
}

export interface Allocation {
  resource: Resource
  supply: number
  totalNeed: number
  levels: LevelRow[]
  official: Metrics
  fair: Metrics
}

export function computeAllocation(
  blocks: Block[],
  resource: Resource,
  supplyFraction: number,
  hazardsOf: (blockId: string) => number,
): Allocation {
  const needs = blocks.map((b) => needOf(b, resource, hazardsOf(b.id)))
  const totalNeed = needs.reduce((s, n) => s + n, 0)
  const supply = totalNeed * supplyFraction
  const official = priorityFill(blocks, needs, supply)
  const fair = maxMinFair(needs, supply)

  const levels = new Map<number, LevelRow>()
  blocks.forEach((b, i) => {
    const row = levels.get(b.level) ?? { level: b.level, need: 0, official: 0, fair: 0, officialCoverage: 0, fairCoverage: 0 }
    row.need += needs[i]
    row.official += official[i]
    row.fair += fair[i]
    levels.set(b.level, row)
  })
  const rows = [...levels.values()].sort((a, b) => a.level - b.level)
  for (const r of rows) {
    r.officialCoverage = r.need === 0 ? 1 : r.official / r.need
    r.fairCoverage = r.need === 0 ? 1 : r.fair / r.need
  }

  return {
    resource,
    supply,
    totalNeed,
    levels: rows,
    official: metricsFor(blocks, needs, official),
    fair: metricsFor(blocks, needs, fair),
  }
}
