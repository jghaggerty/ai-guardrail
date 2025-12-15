export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map(v => stableStringify(v)).join(',')}]`
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${JSON.stringify(key)}:${stableStringify(val)}`)

  return `{${entries.join(',')}}`
}

async function digestHex(serialized: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(serialized)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function computeReproPackHash(packContent: Record<string, unknown>): Promise<{
  hash: string
  serialized: string
  legacyHash: string
  legacySerialized: string
}> {
  const serialized = stableStringify(packContent)
  const legacySerialized = JSON.stringify(packContent)

  const [hash, legacyHash] = await Promise.all([
    digestHex(serialized),
    digestHex(legacySerialized),
  ])

  return { hash, serialized, legacyHash, legacySerialized }
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function importPublicKey(publicKeyPem: string): Promise<CryptoKey> {
  const trimmed = publicKeyPem
    .replace('-----BEGIN PUBLIC KEY-----', '')
    .replace('-----END PUBLIC KEY-----', '')
    .replace(/\s+/g, '')
  const binaryDer = base64ToArrayBuffer(trimmed)
  return crypto.subtle.importKey(
    'spki',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['verify']
  )
}

export async function verifyReproPackSignature(
  publicKeyPem: string,
  contentHash: string,
  signature: string
): Promise<boolean> {
  try {
    const key = await importPublicKey(publicKeyPem)
    const encoder = new TextEncoder()
    const data = encoder.encode(contentHash)
    const signatureBuffer = base64ToArrayBuffer(signature)

    return await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signatureBuffer,
      data
    )
  } catch (error) {
    console.error('Verification failure:', error)
    return false
  }
}
