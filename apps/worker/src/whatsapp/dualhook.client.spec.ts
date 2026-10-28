import { describe, expect, it, vi } from 'vitest'
import { DUALHOOK_API_URL, DualhookClient, DualhookError } from './dualhook.client.js'

const API_KEY = 'dh_live_test-key'
const PHONE_NUMBER_ID = '100000000000001'

const fakeFetch = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response)

const clientWith = (fetchImpl: typeof fetch) =>
  new DualhookClient({ apiKey: API_KEY, phoneNumberId: PHONE_NUMBER_ID, fetchImpl })

const requestOf = (fetchImpl: ReturnType<typeof fakeFetch>, call = 0) => {
  const [url, init] = fetchImpl.mock.calls[call] ?? []
  const headers = (init?.headers ?? {}) as Record<string, string>

  return { url: String(url), init, headers }
}

describe('DualhookClient', () => {
  it('sends a text to the number on Dualhook, with its key as the bearer', async () => {
    const fetchImpl = fakeFetch(Response.json({ messages: [{ id: 'wamid.SENT' }] }))

    const wamid = await clientWith(fetchImpl).sendText('573001234567', 'Hola')

    const { url, init, headers } = requestOf(fetchImpl)
    const body = JSON.parse(String(init?.body))

    expect(wamid).toBe('wamid.SENT')
    expect(url).toBe(`${DUALHOOK_API_URL}/${PHONE_NUMBER_ID}/messages`)
    expect(init?.method).toBe('POST')
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`)
    expect(body).toMatchObject({ to: '573001234567', type: 'text', text: { body: 'Hola' } })
  })

  it('downloads media in one call to /{media_id}/content', async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    const fetchImpl = fakeFetch(
      new Response(bytes, { headers: { 'Content-Type': 'image/png; charset=binary' } }),
    )

    const media = await clientWith(fetchImpl).downloadMedia('MEDIA_ID')

    const { url, headers } = requestOf(fetchImpl)

    // One call and no second hop: the webhook's lookaside URL needs a Meta
    // token that a Dualhook connection does not have.
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(url).toBe(`${DUALHOOK_API_URL}/MEDIA_ID/content`)
    expect(headers['Authorization']).toBe(`Bearer ${API_KEY}`)
    expect(media.mediaType).toBe('image/png')
    expect(Array.from(media.bytes)).toEqual([0xff, 0xd8, 0xff])
  })

  it('falls back to a JPEG when Dualhook names no content type', async () => {
    const response = new Response(new Uint8Array([1]))
    response.headers.delete('content-type')

    const media = await clientWith(fakeFetch(response)).downloadMedia('MEDIA_ID')

    expect(media.mediaType).toBe('image/jpeg')
  })

  it('throws with the status when a send is refused, so the send job retries', async () => {
    const fetchImpl = fakeFetch(
      Response.json({ error: { code: 131047, message: 'Re-engagement message' } }, { status: 400 }),
    )

    const sending = clientWith(fetchImpl).sendText('573001234567', 'Hola')

    await expect(sending).rejects.toBeInstanceOf(DualhookError)
    await expect(sending).rejects.toMatchObject({ status: 400 })
  })

  it('never puts the key in an error message', async () => {
    const fetchImpl = fakeFetch(new Response('nope', { status: 401 }))

    const download = clientWith(fetchImpl).downloadMedia('MEDIA_ID')

    await expect(download).rejects.toBeInstanceOf(DualhookError)
    await expect(download).rejects.not.toThrow(API_KEY)
  })

  it('swallows a failed read receipt: it must not take the turn down', async () => {
    const fetchImpl = fakeFetch(new Response('', { status: 500 }))

    await expect(clientWith(fetchImpl).markAsRead('wamid.IN')).resolves.toBeUndefined()

    const body = JSON.parse(String(requestOf(fetchImpl).init?.body))

    expect(body).toMatchObject({ status: 'read', message_id: 'wamid.IN' })
  })
})
