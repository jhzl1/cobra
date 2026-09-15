import { ConfigService } from '@nestjs/config'
import { randomBytes } from 'node:crypto'
import { CredentialsCryptoService } from './credentials-crypto.service'

const configWith = (key: string): ConfigService =>
  ({ getOrThrow: () => key }) as unknown as ConfigService

describe('CredentialsCryptoService', () => {
  const key = randomBytes(32).toString('base64')

  it('round-trips a credential and exposes only its last four characters', () => {
    const service = new CredentialsCryptoService(configWith(key))

    const { ciphertext, last4 } = service.encrypt({
      secret: 'EAAG-super-secret-token-9821',
      extra: { wabaId: '109695075453765' },
    })

    expect(last4).toBe('9821')
    expect(ciphertext).not.toContain('super-secret')
    expect(service.decrypt(ciphertext)).toEqual({
      secret: 'EAAG-super-secret-token-9821',
      extra: { wabaId: '109695075453765' },
    })
  })

  it('refuses a ciphertext that was edited, instead of decrypting it into something else', () => {
    const service = new CredentialsCryptoService(configWith(key))
    const { ciphertext } = service.encrypt({ secret: 'token-1234' })

    const [version, iv, tag, payload] = ciphertext.split('.')
    const tampered = [version, iv, tag, `${payload?.slice(0, -2)}AA`].join('.')

    expect(() => service.decrypt(tampered)).toThrow()
  })

  it('refuses a master key that is not 32 bytes', () => {
    expect(() => new CredentialsCryptoService(configWith('c2hvcnQ='))).toThrow(
      /32 bytes/,
    )
  })
})
