import { p256 } from '@noble/curves/nist.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js'
import type { Msg, MsgBody } from '../types'

/**
 * Signing is ECDSA P-256 everywhere. Laptops use WebCrypto (fast, native). Phones that open
 * the app over plain http on the hotspot have no `crypto.subtle` (it needs a secure context),
 * so they fall back to @noble/curves. Both produce raw r||s signatures over SHA-256 and verify
 * each other's messages (see mesh.test.ts).
 */
const subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle
export const hasWebCrypto = !!subtle
const KEY_ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIG_ALG = { name: 'ECDSA', hash: 'SHA-256' } as const

export interface Identity {
  /** Raw uncompressed P-256 public key, hex. */
  pub: string
  /** Short stable id shown in the UI and used to count "distinct devices". */
  deviceKey: string
  sign(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array>
  /** What db.ts persists to restore this identity. */
  stored: StoredIdentity
}

export type StoredIdentity = { kind: 'webcrypto'; pair: CryptoKeyPair } | { kind: 'noble'; secret: string }

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  return [...(buf instanceof Uint8Array ? buf : new Uint8Array(buf))].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function fromHex(h: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(h.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** crypto.randomUUID needs a secure context too; getRandomValues does not. */
export function uid(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = toHex(b)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export const fingerprint = (pub: string) => pub.slice(2, 18)

export async function identityFromStored(s: StoredIdentity): Promise<Identity> {
  if (s.kind === 'noble') {
    const secret = fromHex(s.secret)
    const pub = toHex(p256.getPublicKey(secret, false))
    return { pub, deviceKey: fingerprint(pub), stored: s, sign: async (bytes) => p256.sign(bytes, secret) }
  }
  const pub = toHex(await subtle!.exportKey('raw', s.pair.publicKey))
  return {
    pub,
    deviceKey: fingerprint(pub),
    stored: s,
    sign: async (bytes) => new Uint8Array(await subtle!.sign(SIG_ALG, s.pair.privateKey, bytes)),
  }
}

export async function newIdentity(forceNoble = false): Promise<Identity> {
  if (subtle && !forceNoble) {
    const pair = await subtle.generateKey(KEY_ALG, false, ['sign', 'verify'])
    return identityFromStored({ kind: 'webcrypto', pair })
  }
  return identityFromStored({ kind: 'noble', secret: toHex(p256.keygen().secretKey) })
}

/** Key order must not matter to the signature, so serialise with sorted keys. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v)
}

const bodyBytes = (b: MsgBody) =>
  new TextEncoder().encode(stable({ id: b.id, blockId: b.blockId, ts: b.ts, wall: b.wall, data: b.data })) as Uint8Array<ArrayBuffer>

export async function signBody(id: Identity, body: MsgBody, origin: Msg['origin'], ttl = 16): Promise<Msg> {
  const sig = toHex(await id.sign(bodyBytes(body)))
  return { ...body, pub: id.pub, sig, hops: 0, ttl, origin }
}

const keyCache = new Map<string, CryptoKey>()

export async function verifyMsg(m: Msg): Promise<boolean> {
  try {
    if (!subtle) return p256.verify(fromHex(m.sig), bodyBytes(m), fromHex(m.pub), { lowS: false })
    let key = keyCache.get(m.pub)
    if (!key) {
      key = await subtle.importKey('raw', fromHex(m.pub), KEY_ALG, true, ['verify'])
      keyCache.set(m.pub, key)
    }
    return await subtle.verify(SIG_ALG, key, fromHex(m.sig), bodyBytes(m))
  } catch {
    return false
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  return subtle ? toHex(await subtle.digest('SHA-256', bytes)) : toHex(sha256(bytes))
}

/**
 * Family phrases are stretched with PBKDF2 so a guessed phrase costs 100k hashes to test.
 * The salt is fixed (families must derive the same value without talking), so this slows
 * brute force rather than stopping it: the UI asks for long phrases.
 */
export const PHRASE_SALT = 'lantern-family-v1'
export const PHRASE_ITERATIONS = 100_000
const phraseCache = new Map<string, Promise<string>>()

export function phraseHash(phrase: string): Promise<string> {
  let p = phraseCache.get(phrase)
  if (!p) {
    p = derive(phrase)
    phraseCache.set(phrase, p)
  }
  return p
}

async function derive(phrase: string): Promise<string> {
  const enc = new TextEncoder()
  if (subtle) {
    const key = await subtle.importKey('raw', enc.encode(phrase), 'PBKDF2', false, ['deriveBits'])
    const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(PHRASE_SALT), iterations: PHRASE_ITERATIONS }, key, 256)
    return toHex(bits)
  }
  return toHex(await pbkdf2Async(sha256, phrase, PHRASE_SALT, { c: PHRASE_ITERATIONS, dkLen: 32 }))
}

/** Rough strength hint for a family phrase (bits of guessing work, not a guarantee). */
export function phraseStrength(phrase: string): { bits: number; label: 'weak' | 'fair' | 'strong' } {
  const p = phrase.trim()
  if (!p) return { bits: 0, label: 'weak' }
  const words = p.split(/[\s\-_.]+/).filter(Boolean).length
  let pool = 0
  if (/[a-z]/.test(p)) pool += 26
  if (/[A-Z]/.test(p)) pool += 26
  if (/[0-9]/.test(p)) pool += 10
  if (/[^a-zA-Z0-9]/.test(p)) pool += 12
  // Dictionary words are far easier to guess than random characters; credit ~11 bits per word.
  const bits = Math.round(Math.min(p.length * Math.log2(Math.max(pool, 2)), words * 11 + 6))
  return { bits, label: bits >= 50 ? 'strong' : bits >= 34 ? 'fair' : 'weak' }
}
