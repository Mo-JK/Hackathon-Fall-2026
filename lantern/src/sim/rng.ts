// ---------- deterministic randomness ----------

export function rngFor(...parts: number[]): () => number {
  let h = 2166136261
  for (const p of parts) {
    h ^= p + 0x9e3779b9
    h = Math.imul(h, 16777619)
    h ^= h >>> 15
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function gauss(r: () => number): number {
  const u = Math.max(r(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
}

export function poisson(r: () => number, lambda: number): number {
  const limit = Math.exp(-lambda)
  let k = 0
  let p = 1
  do {
    k++
    p *= r()
  } while (p > limit && k < 60)
  return k - 1
}
