/**
 * Problem 15: plan the move back up.
 * Shafts are pipes with a daily capacity; each serves a range of levels. Every day we compute
 * a maximum flow from the levels through the open shafts. The "fair" plan first offers each
 * level a share of the day's lift capacity in proportion to remaining people x hardship (the
 * same need weighting as the power rule), then fills any spare capacity. The baseline moves
 * levels strictly top-down, which is what the Directorate does with power today.
 */
import type { Shaft } from '../sim/hollow'

export interface LevelPop {
  level: number
  people: number
  hardship: number
}

/** Edmonds-Karp on an adjacency matrix. Returns the flow matrix. */
export function maxFlow(cap: number[][], s: number, t: number): { value: number; flow: number[][] } {
  const n = cap.length
  const flow = cap.map((row) => row.map(() => 0))
  let value = 0
  for (;;) {
    const prev = new Array<number>(n).fill(-1)
    prev[s] = s
    const q = [s]
    while (q.length && prev[t] === -1) {
      const u = q.shift()!
      for (let v = 0; v < n; v++) {
        if (prev[v] === -1 && cap[u][v] - flow[u][v] > 1e-9) {
          prev[v] = u
          q.push(v)
        }
      }
    }
    if (prev[t] === -1) return { value, flow }
    let push = Infinity
    for (let v = t; v !== s; v = prev[v]) push = Math.min(push, cap[prev[v]][v] - flow[prev[v]][v])
    for (let v = t; v !== s; v = prev[v]) {
      flow[prev[v]][v] += push
      flow[v][prev[v]] -= push
    }
    value += push
  }
}

/** One day's lift: how many people each level can move given per-level caps and shaft capacity. */
function liftDay(levels: LevelPop[], shafts: Shaft[], levelCap: number[], shaftLeft: number[]): number[] {
  const L = levels.length
  const S = shafts.length
  const n = L + S + 2
  const src = 0
  const sink = n - 1
  const cap = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  levels.forEach((l, i) => {
    cap[src][1 + i] = levelCap[i]
    shafts.forEach((sh, j) => {
      if (sh.levels.includes(l.level)) cap[1 + i][1 + L + j] = Infinity
    })
  })
  shafts.forEach((_, j) => (cap[1 + L + j][sink] = shaftLeft[j]))
  const { flow } = maxFlow(cap, src, sink)
  shafts.forEach((_, j) => (shaftLeft[j] -= flow[1 + L + j][sink]))
  return levels.map((_, i) => flow[src][1 + i])
}

export interface Plan {
  policy: 'fair' | 'upper'
  /** Day each level's first and last people reach the surface (Infinity if no open shaft serves it). */
  start: Map<number, number>
  finish: Map<number, number>
  days: number
}

const MAX_DAYS = 400

export function planReturn(levelsIn: LevelPop[], shafts: Shaft[], policy: 'fair' | 'upper'): Plan {
  const levels = [...levelsIn].sort((a, b) => a.level - b.level)
  const left = levels.map((l) => l.people)
  const start = new Map<number, number>()
  const finish = new Map<number, number>()
  const reachable = levels.map((l) => shafts.some((s) => s.levels.includes(l.level)))
  let day = 0
  while (day < MAX_DAYS && left.some((x, i) => x > 0.5 && reachable[i])) {
    day++
    const shaftLeft = shafts.map((s) => s.capPerDay)
    const moved = levels.map(() => 0)
    if (policy === 'upper') {
      // Strictly top-down: a level only gets lift capacity once every level above is done.
      for (let i = 0; i < levels.length; i++) {
        if (left[i] <= 0.5 || !reachable[i]) continue
        const caps = levels.map((_, k) => (k === i ? left[i] : 0))
        const m = liftDay(levels, shafts, caps, shaftLeft)
        moved[i] += m[i]
      }
    } else {
      const total = shaftLeft.reduce((s, c) => s + c, 0)
      const weight = levels.map((l, i) => (reachable[i] ? left[i] * l.hardship : 0))
      const W = weight.reduce((s, w) => s + w, 0)
      const target = levels.map((_, i) => (W ? Math.min(left[i], (total * weight[i]) / W) : 0))
      const first = liftDay(levels, shafts, target, shaftLeft)
      const spare = levels.map((_, i) => left[i] - first[i])
      const second = liftDay(levels, shafts, spare, shaftLeft)
      for (let i = 0; i < levels.length; i++) moved[i] = first[i] + second[i]
    }
    levels.forEach((l, i) => {
      if (moved[i] > 0.5 && !start.has(l.level)) start.set(l.level, day)
      left[i] -= moved[i]
      if (left[i] <= 0.5 && !finish.has(l.level)) finish.set(l.level, day)
    })
  }
  levels.forEach((l, i) => {
    if (!reachable[i]) {
      start.set(l.level, Infinity)
      finish.set(l.level, Infinity)
    }
  })
  return { policy, start, finish, days: day }
}
