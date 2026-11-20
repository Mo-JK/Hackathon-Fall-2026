import { useSyncExternalStore } from 'react'
import { store } from './store'
import type { Snapshot } from './store'

export const useSnap = (): Snapshot => useSyncExternalStore(store.subscribe, store.getSnapshot)

/** Simulated clock: the day starts at 06:00 and one tick is 10 minutes. */
export function simClock(tick: number): string {
  const minutes = 360 + tick * 10
  const day = 1 + Math.floor(minutes / 1440)
  const hh = String(Math.floor((minutes % 1440) / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return `Day ${day} · ${hh}:${mm}`
}

export const pct = (x: number) => `${Math.round(x * 100)}%`
export const num = (n: number) => Math.round(n).toLocaleString('en-US')
