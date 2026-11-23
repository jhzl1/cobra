import type { Request } from 'express'
import { publicUrlOf } from './public-url'

const requestWith = (headers: Record<string, string | string[]>, protocol = 'http') =>
  ({ headers, protocol }) as unknown as Request

describe('publicUrlOf', () => {
  it('uses the tunnel headers, which is what makes ngrok need no configuration', () => {
    const request = requestWith({
      host: 'a1b2c3d4.ngrok-free.app',
      'x-forwarded-proto': 'https',
    })

    expect(publicUrlOf(request)).toBe('https://a1b2c3d4.ngrok-free.app')
  })

  it('prefers x-forwarded-host when a proxy rewrote the host', () => {
    const request = requestWith({
      host: 'internal:3000',
      'x-forwarded-host': 'cobra.example.com',
      'x-forwarded-proto': 'https',
    })

    expect(publicUrlOf(request)).toBe('https://cobra.example.com')
  })

  it('takes the first value when several proxies appended their own', () => {
    // Express gives these as a comma-joined string, or as an array when the
    // header arrived more than once. Taking the last one hands over the URL of
    // the hop closest to us, which is the private one.
    const request = requestWith({
      host: 'internal:3000',
      'x-forwarded-host': 'cobra.example.com, internal.railway.internal',
      'x-forwarded-proto': ['https', 'http'],
    })

    expect(publicUrlOf(request)).toBe('https://cobra.example.com')
  })

  it('falls back to the request itself when nothing is proxying', () => {
    expect(publicUrlOf(requestWith({ host: 'localhost:3000' }))).toBe('http://localhost:3000')
  })

  it('lets PUBLIC_URL win, without a trailing slash', () => {
    const request = requestWith({ host: 'a1b2c3d4.ngrok-free.app' })

    expect(publicUrlOf(request, 'https://api.cobra.co/')).toBe('https://api.cobra.co')
  })

  it('answers empty rather than building a broken URL when there is no host', () => {
    expect(publicUrlOf(requestWith({}))).toBe('')
  })
})
