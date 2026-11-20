import Dexie from 'dexie'
import type { Table } from 'dexie'
import type { Msg } from './types'
import type { Identity } from './mesh/crypto'
import { identityFromKeys, newIdentity } from './mesh/crypto'

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

/** The device keypair persists across reloads. Falls back to a fresh in-memory key if storage is blocked. */
export async function loadIdentity(): Promise<Identity> {
  try {
    const row = await db.meta.get('identity')
    if (row) return await identityFromKeys(row.value as CryptoKeyPair)
  } catch {
    /* fall through */
  }
  const id = await newIdentity()
  try {
    await db.meta.put({ key: 'identity', value: { privateKey: id.privateKey, publicKey: id.publicKey } })
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
