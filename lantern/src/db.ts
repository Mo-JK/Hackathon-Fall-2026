import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Msg } from './types'
import type { Identity, StoredIdentity } from './mesh/crypto'
import { identityFromStored, newIdentity } from './mesh/crypto'

interface Meta {
  key: string
  value: unknown
}

class LanternDB extends Dexie {
  meta!: Table<Meta, string>
  /** My own signed messages, kept so they can be forwarded when a peer appears. */
  outbox!: Table<Msg, string>

  constructor() {
    super('lantern')
    this.version(1).stores({ meta: 'key', outbox: 'id' })
  }
}

const db = new LanternDB()

/** v1 stored a bare CryptoKeyPair. */
function upgrade(v: unknown): StoredIdentity | null {
  if (!v || typeof v !== 'object') return null
  if ('kind' in v) return v as StoredIdentity
  if ('privateKey' in v && 'publicKey' in v) return { kind: 'webcrypto', pair: v as CryptoKeyPair }
  return null
}

/**
 * The device keypair persists across reloads. `slot` keeps a separate key for phone mode so one
 * laptop can play a laptop and a phone at once. Falls back to an in-memory key if storage is blocked.
 */
export async function loadIdentity(slot = 'identity'): Promise<Identity> {
  try {
    const row = await db.meta.get(slot)
    const stored = upgrade(row?.value)
    if (stored) return await identityFromStored(stored)
  } catch {
    /* fall through */
  }
  const id = await newIdentity()
  try {
    await db.meta.put({ key: slot, value: id.stored })
  } catch {
    /* storage unavailable; identity lasts for this session */
  }
  return id
}

export async function saveOutbox(m: Msg): Promise<void> {
  try {
    await db.outbox.put(m)
  } catch {
    /* ignore */
  }
}

export async function loadOutbox(): Promise<Msg[]> {
  try {
    return await db.outbox.toArray()
  } catch {
    return []
  }
}

/** Forget this device's saved messages (keeps its key). Used by ?fresh for a clean demo recording. */
export async function clearOutbox(): Promise<void> {
  try {
    await db.outbox.clear()
  } catch {
    /* ignore */
  }
}
