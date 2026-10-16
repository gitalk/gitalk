/**
 * PKCS#1 -> PKCS#8 conversion for GitHub App private keys.
 *
 * GitHub hands you a PKCS#1 key (`-----BEGIN RSA PRIVATE KEY-----`), but
 * WebCrypto's `importKey('pkcs8', …)` only accepts PKCS#8. Asking every
 * self-hoster to run `openssl pkcs8 -topk8 -nocrypt` by hand is a needless
 * footgun, so the envelope is rebuilt here.
 *
 * Node's crypto is unavailable in Workers and we do not want a dependency for
 * this, hence the hand-rolled DER encoding. The structures involved are fixed
 * and tiny:
 *
 *   PrivateKeyInfo ::= SEQUENCE {
 *     version             INTEGER (0),
 *     privateKeyAlgorithm AlgorithmIdentifier,   -- rsaEncryption, NULL params
 *     privateKey          OCTET STRING           -- the PKCS#1 bytes
 *   }
 */

/** OID 1.2.840.113549.1.1.1 (rsaEncryption) wrapped in its AlgorithmIdentifier. */
const RSA_ALGORITHM_IDENTIFIER = new Uint8Array([
  0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00
])

/** Encode one DER TLV: tag, definite length, contents. */
function der(tag: number, content: Uint8Array): Uint8Array {
  const lengthBytes: number[] = []
  if (content.length < 0x80) {
    lengthBytes.push(content.length)
  } else {
    const big: number[] = []
    for (let n = content.length; n > 0; n = Math.floor(n / 256)) big.unshift(n % 256)
    lengthBytes.push(0x80 | big.length, ...big)
  }

  const out = new Uint8Array(1 + lengthBytes.length + content.length)
  out[0] = tag
  out.set(lengthBytes, 1)
  out.set(content, 1 + lengthBytes.length)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

interface Tlv {
  tag: number
  start: number
  end: number
  next: number
}

/** Read a DER TLV header, or `null` if it is truncated or out of bounds. */
function readTlv(bytes: Uint8Array, offset: number): Tlv | null {
  const tag = bytes[offset]
  if (tag === undefined) return null

  let cursor = offset + 1
  let length = bytes[cursor]
  if (length === undefined) return null
  cursor += 1

  if (length & 0x80) {
    const count = length & 0x7f
    length = 0
    for (let i = 0; i < count; i++) {
      const byte = bytes[cursor]
      if (byte === undefined) return null
      length = length * 256 + byte
      cursor += 1
    }
  }

  if (cursor + length > bytes.length) return null
  return { tag, start: cursor, end: cursor + length, next: cursor + length }
}

/**
 * Whether `bytes` is a bare PKCS#1 RSAPrivateKey rather than PKCS#8.
 *
 * Both open with `SEQUENCE { INTEGER 0, … }`, so the version integer cannot
 * tell them apart; the tag after it can. PKCS#8 continues with an
 * AlgorithmIdentifier (0x30), PKCS#1 with the modulus INTEGER (0x02).
 *
 * Reading the DER instead of the PEM header means a key pasted without its
 * `-----BEGIN … -----` line still works.
 */
export function isPkcs1(bytes: Uint8Array): boolean {
  const outer = readTlv(bytes, 0)
  if (!outer || outer.tag !== 0x30) return false

  const version = readTlv(bytes, outer.start)
  if (!version || version.tag !== 0x02) return false
  if (version.end - version.start !== 1 || bytes[version.start] !== 0) return false

  return bytes[version.next] === 0x02
}

/** Wrap a PKCS#1 RSAPrivateKey in a PKCS#8 PrivateKeyInfo envelope. */
export function pkcs1ToPkcs8(pkcs1: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00])
  return der(0x30, concat(version, RSA_ALGORITHM_IDENTIFIER, der(0x04, pkcs1)))
}

/**
 * Normalise a PEM private key to PKCS#8 DER.
 *
 * Tolerates both PEM headers, a value whose newlines are escaped as literal
 * `\n` (which is how it must be stored in a `.env` or a `wrangler secret`),
 * and a bare base64 body with no header at all.
 */
export function pemToPkcs8(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')

  const bytes = Uint8Array.from(atob(body), (char) => char.charCodeAt(0))
  return isPkcs1(bytes) ? pkcs1ToPkcs8(bytes) : bytes
}
