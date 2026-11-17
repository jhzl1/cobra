import { BadRequestException } from '@nestjs/common'
import { decodeCursor, encodeCursor } from './cursor'

const ID = '0f8fad5b-d9cb-469f-a165-70867728950e'
const AT = '2026-11-17T20:56:41.123456+00:00'

const forge = (cursor: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

const errorOf = (cursor: string): unknown => {
  try {
    decodeCursor(cursor)

    return null
  } catch (error) {
    return error
  }
}

/**
 * The decoded values are written into a PostgREST filter string, so anything
 * that is not exactly a uuid and a timestamp could widen the filter.
 */
describe('decodeCursor', () => {
  it('returns the exact timestamp it was given, microseconds included', () => {
    expect(decodeCursor(encodeCursor({ at: AT, id: ID }))).toEqual({ at: AT, id: ID })
  })

  it('accepts the cursor of a conversation that never had a message', () => {
    expect(decodeCursor(encodeCursor({ at: null, id: ID }))).toEqual({ at: null, id: ID })
  })

  it('refuses an id that carries filter syntax', () => {
    const cursor = forge({ at: AT, id: `${ID}),tenant_id.neq.x` })

    expect(errorOf(cursor)).toBeInstanceOf(BadRequestException)
  })

  it('refuses a timestamp that carries filter syntax', () => {
    const cursor = forge({ at: `${AT}",id.gt.0`, id: ID })

    expect(errorOf(cursor)).toBeInstanceOf(BadRequestException)
  })

  it('refuses a value that is not a cursor at all', () => {
    expect(errorOf('not-a-cursor')).toBeInstanceOf(BadRequestException)
  })
})
