import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const VERSION = 'v1'

export interface CredentialPayload {
  secret: string
  /** Meta's non-secret companions travel in the same envelope: wabaId, appSecret. */
  extra?: Record<string, string>
}

export class CredentialDecryptionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CredentialDecryptionError'
  }
}

/**
 * Tenant credentials, encrypted in the application with a master key held in
 * the environment.
 *
 * AES-256-GCM rather than CBC because the tag authenticates the ciphertext: a
 * row edited in the database fails to decrypt instead of decrypting into
 * something else.
 *
 * The stored form is `v1.<iv>.<tag>.<ciphertext>`, all base64url. The version
 * prefix is what makes a key rotation a migration rather than a rewrite.
 */
export class CredentialsCrypto {
  private readonly key: Buffer

  constructor(masterKeyBase64: string) {
    const key = Buffer.from(masterKeyBase64, 'base64')

    if (key.length !== 32) {
      throw new Error('CREDENTIALS_MASTER_KEY must be 32 bytes in base64 (openssl rand -base64 32)')
    }

    this.key = key
  }

  encrypt(payload: CredentialPayload): { ciphertext: string; last4: string } {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)

    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8')
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])

    return {
      ciphertext: [VERSION, b64(iv), b64(cipher.getAuthTag()), b64(encrypted)].join('.'),
      last4: payload.secret.slice(-4),
    }
  }

  decrypt(ciphertext: string): CredentialPayload {
    const [version, iv, tag, payload] = ciphertext.split('.')

    if (version !== VERSION || !iv || !tag || !payload) {
      throw new CredentialDecryptionError('La credencial guardada no tiene un formato válido')
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, unb64(iv))
      decipher.setAuthTag(unb64(tag))

      const plaintext = Buffer.concat([decipher.update(unb64(payload)), decipher.final()])

      return JSON.parse(plaintext.toString('utf8')) as CredentialPayload
    } catch {
      // Either the master key changed or the row was tampered with. From here
      // both are the same answer: this credential cannot be used.
      throw new CredentialDecryptionError('No se pudo descifrar la credencial')
    }
  }
}

const b64 = (value: Buffer): string => value.toString('base64url')
const unb64 = (value: string): Buffer => Buffer.from(value, 'base64url')
