/**
 * The map from the brief's 15 problems to Lantern's tabs. The UI, the demo and the
 * "15 problems" strip all read from here, so adding a module is one entry.
 */
import type { TabId } from '../store'

export type Group = 'sense' | 'share' | 'reach'

export const PROBLEMS: Record<number, string> = {
  1: 'Warn before power or air cuts out',
  2: 'Share power, water and food fairly',
  3: 'Keep the hot deep levels livable',
  4: 'Catch bad water before people drink it',
  5: 'Keep flooded tunnels safe to move through',
  6: 'Find or share space',
  7: 'Organise and call for help without the network',
  8: 'Reconnect families after a blackout',
  9: 'Track the real outbreak and route supplies',
  10: 'Basic care far from a clinic',
  11: 'Measure what life without sunlight does',
  12: 'A neighbourhood that feeds itself',
  13: 'Prove whether the surface is safe',
  14: 'Who goes up first, and in what',
  15: 'Plan the move back up',
}

export interface TabDef {
  id: TabId
  label: string
  group: Group
  problems: number[]
}

export const GROUPS: { id: Group; label: string; blurb: string }[] = [
  { id: 'sense', label: 'Sense', blurb: 'Know what is really happening' },
  { id: 'share', label: 'Share', blurb: 'Split what is scarce, fairly' },
  { id: 'reach', label: 'Reach', blurb: 'Find people and safe paths' },
]

export const TABS: TabDef[] = [
  { id: 'alerts', label: 'Warnings', group: 'sense', problems: [1, 4] },
  { id: 'outbreak', label: 'Outbreak', group: 'sense', problems: [9] },
  { id: 'heat', label: 'Heat', group: 'sense', problems: [3] },
  { id: 'surface', label: 'Proof of Air', group: 'sense', problems: [13] },
  { id: 'share', label: 'Fair share', group: 'share', problems: [2] },
  { id: 'care', label: 'Care', group: 'share', problems: [10, 9] },
  { id: 'food', label: 'Food', group: 'share', problems: [12] },
  { id: 'space', label: 'Space', group: 'share', problems: [6] },
  { id: 'light', label: 'Light & body', group: 'share', problems: [11] },
  { id: 'return', label: 'The way up', group: 'share', problems: [14, 15] },
  { id: 'mesh', label: 'Mesh & trust', group: 'reach', problems: [7] },
  { id: 'routes', label: 'Routes & SOS', group: 'reach', problems: [5, 7] },
  { id: 'family', label: 'Family', group: 'reach', problems: [8] },
]

export const groupOf = (tab: TabId): Group => TABS.find((t) => t.id === tab)?.group ?? 'sense'
