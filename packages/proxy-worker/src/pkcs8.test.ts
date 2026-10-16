// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { isPkcs1, pemToPkcs8, pkcs1ToPkcs8 } from './pkcs8'

/**
 * These tests generate a real RSA key at run time and peel the PKCS#1 key out
 * of its PKCS#8 envelope, so no private key fixture has to live in the repo.
 */

/** Minimal DER reader, used only to take the test key apart. */
function readTlv(bytes: Uint8Array, offset: number) {
  const tag = bytes[offset]
  if (tag === undefined) throw new Error(`truncated DER at ${offset}`)

  let cursor = offset + 1
  let length = bytes[cursor]
  if (length === undefined) throw new Error(`truncated DER at ${cursor}`)
  cursor += 1

  if (length & 0x80) {
    const count = length & 0x7f
    length = 0
    for (let i = 0; i < count; i++) {
      const byte = bytes[cursor]
      if (byte === undefined) throw new Error(`truncated DER at ${cursor}`)
      length = length * 256 + byte
      cursor += 1
    }
  }

  return { tag, start: cursor, end: cursor + length, next: cursor + length }
}

/** The inner PKCS#1 key carried by a PKCS#8 PrivateKeyInfo. */
function unwrapPkcs8(pkcs8: Uint8Array): Uint8Array {
  const outer = readTlv(pkcs8, 0)
  const version = readTlv(pkcs8, outer.start)
  const algorithm = readTlv(pkcs8, version.next)
  const key = readTlv(pkcs8, algorithm.next)
  return pkcs8.slice(key.start, key.end)
}

async function generatePkcs8(): Promise<Uint8Array> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256'
    },
    true,
    ['sign', 'verify']
  )) as CryptoKeyPair

  return new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey))
}

function toPem(bytes: Uint8Array, label: string): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const lines = btoa(binary).match(/.{1,64}/g) ?? []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

async function importable(der: Uint8Array): Promise<boolean> {
  try {
    await crypto.subtle.importKey(
      'pkcs8',
      der.buffer as ArrayBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )
    return true
  } catch {
    return false
  }
}

describe('isPkcs1', () => {
  it('tells PKCS#1 and PKCS#8 apart from the DER alone', async () => {
    const pkcs8 = await generatePkcs8()

    expect(isPkcs1(unwrapPkcs8(pkcs8))).toBe(true)
    expect(isPkcs1(pkcs8)).toBe(false)
  })

  it('rejects input that is not a private key at all', () => {
    expect(isPkcs1(new Uint8Array([0x30, 0x00]))).toBe(false)
    expect(isPkcs1(new Uint8Array([]))).toBe(false)
  })
})

describe('pkcs1ToPkcs8', () => {
  it('wraps a bare PKCS#1 key into an importable PKCS#8 envelope', async () => {
    const pkcs1 = unwrapPkcs8(await generatePkcs8())
    const wrapped = pkcs1ToPkcs8(pkcs1)

    expect(isPkcs1(wrapped)).toBe(false)
    // The original key is carried verbatim as the trailing OCTET STRING.
    expect(Array.from(wrapped.slice(wrapped.length - pkcs1.length))).toEqual(Array.from(pkcs1))
    expect(await importable(wrapped)).toBe(true)
  })

  it('uses long-form DER lengths for keys too big for short form', async () => {
    const pkcs1 = unwrapPkcs8(await generatePkcs8())
    const wrapped = pkcs1ToPkcs8(pkcs1)

    expect(pkcs1.length).toBeGreaterThan(0x7f)
    expect(wrapped[0]).toBe(0x30)
    expect((wrapped[1] ?? 0) & 0x80).toBe(0x80)
  })
})

describe('pemToPkcs8', () => {
  it('accepts a PKCS#1 PEM and actually converts it', async () => {
    const pkcs1 = unwrapPkcs8(await generatePkcs8())
    const converted = pemToPkcs8(toPem(pkcs1, 'RSA PRIVATE KEY'))

    expect(converted).not.toEqual(pkcs1)
    expect(await importable(converted)).toBe(true)
  })

  it('passes a PKCS#8 PEM through unchanged', async () => {
    const pkcs8 = await generatePkcs8()

    expect(pemToPkcs8(toPem(pkcs8, 'PRIVATE KEY'))).toEqual(pkcs8)
  })

  it('accepts newlines escaped as literal \\n, as a .env value must be', async () => {
    const pkcs1 = unwrapPkcs8(await generatePkcs8())
    const escaped = toPem(pkcs1, 'RSA PRIVATE KEY').replace(/\n/g, '\\n')

    expect(await importable(pemToPkcs8(escaped))).toBe(true)
  })

  it('accepts a bare base64 body with the PEM header stripped off', async () => {
    const pkcs1 = unwrapPkcs8(await generatePkcs8())

    expect(await importable(pemToPkcs8(toBase64(pkcs1)))).toBe(true)
  })
})
