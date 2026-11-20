import type { Msg, MsgBody } from '../types'

const subtle = globalThis.crypto.subtle
const KEY_ALG = { name: 'ECDSA', namedCurve: 'P-256' } as const
const SIG_ALG = { name: 'ECDSA', hash: 'SHA-256' } as const

export interface Identity {
  /** Raw P-256 public key, hex. */
  pub: string
  /** Short stable id shown in the UI and used to count "distinct devices". */
  deviceKey: string
  privateKey: CryptoKey
  publicKey: CryptoKey
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(h: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(h.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16)
  return out
}

export const fingerprint = (pub: string) => pub.slice(2, 18)

export async function identityFromKeys(kp: CryptoKeyPair): Promise<Identity> {
  const pub = toHex(await subtle.exportKey('raw', kp.publicKey))
  return { pub, deviceKey: fingerprint(pub), privateKey: kp.privateKey, publicKey: kp.publicKey }
}

export async function newIdentity(): Promise<Identity> {
  return identityFromKeys(await subtle.generateKey(KEY_ALG, false, ['sign', 'verify']))
}

/** Key order must not matter to the signature, so serialise with sorted keys. */
function stable(v: unknown): string {
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
  new TextEncoder().encode(stable({ id: b.id, blockId: b.blockId, ts: b.ts, wall: b.wall, data: b.data }))

export async function signBody(id: Identity, body: MsgBody, origin: Msg['origin'], ttl = 16): Promise<Msg> {
  const sig = toHex(await subtle.sign(SIG_ALG, id.privateKey, bodyBytes(body)))
  return { ...body, pub: id.pub, sig, hops: 0, ttl, origin }
}

const keyCache = new Map<string, CryptoKey>()

export async function verifyMsg(m: Msg): Promise<boolean> {
  try {
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
  return toHex(await subtle.digest('SHA-256', new TextEncoder().encode(text)))
}
