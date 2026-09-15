import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { CredentialsCrypto } from './credentials-crypto'

describe('CredentialsCrypto', () => {
  const key = randomBytes(32).toString('base64')

  it('round-trips a credential and exposes only its last four characters', () => {
    const crypto = new CredentialsCrypto(key)

    const { ciphertext, last4 } = crypto.encrypt({
      secret: 'EAAG-super-secret-token-9821',
      extra: { wabaId: '109695075453765' },
    })

    expect(last4).toBe('9821')
    expect(ciphertext).not.toContain('super-secret')
    expect(crypto.decrypt(ciphertext)).toEqual({
      secret: 'EAAG-super-secret-token-9821',
      extra: { wabaId: '109695075453765' },
    })
  })

  it('refuses a ciphertext that was edited instead of decrypting it into something else', () => {
    const crypto = new CredentialsCrypto(key)
    const { ciphertext } = crypto.encrypt({ secret: 'token-1234' })

    const [version, iv, tag, payload] = ciphertext.split('.')
    const tampered = [version, iv, tag, `${payload?.slice(0, -2)}AA`].join('.')

    expect(() => crypto.decrypt(tampered)).toThrow(/descifrar/)
  })

  it('refuses a master key that is not 32 bytes', () => {
    expect(() => new CredentialsCrypto('c2hvcnQ=')).toThrow(/32 bytes/)
  })
})
