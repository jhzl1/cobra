import { createHmac } from 'node:crypto'
import { verifyMetaSignature } from './signature'

const SECRET = 'app-secret'
const sign = (body: Buffer) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`

describe('verifyMetaSignature', () => {
  it('accepts a body signed with the app secret', () => {
    const body = Buffer.from(JSON.stringify({ hola: 'qué más' }), 'utf8')

    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true)
  })

  it('rejects the same payload re-serialised, which is why the raw bytes are kept', () => {
    // Meta escapes non-ASCII; JSON.stringify of the parsed object does not. The
    // two byte strings differ and the signature is computed over the bytes.
    const asMetaSentIt = Buffer.from('{"text":"\\u00bfqu\\u00e9 m\\u00e1s?"}', 'utf8')
    const reserialized = Buffer.from(JSON.stringify(JSON.parse(asMetaSentIt.toString())), 'utf8')

    expect(verifyMetaSignature(reserialized, sign(asMetaSentIt), SECRET)).toBe(false)
  })

  it('rejects a missing or malformed header instead of throwing', () => {
    const body = Buffer.from('{}')

    expect(verifyMetaSignature(body, undefined, SECRET)).toBe(false)
    expect(verifyMetaSignature(body, 'sha1=abc', SECRET)).toBe(false)
    expect(verifyMetaSignature(body, 'sha256=00', SECRET)).toBe(false)
  })
})
