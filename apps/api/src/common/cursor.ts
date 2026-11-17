import { BadRequestException } from '@nestjs/common'

/**
 * Where a list sorted by time, newest first, stopped: the timestamp of the last
 * row sent and its id, which breaks ties between rows written in the same
 * microsecond.
 *
 * The timestamp travels as the exact string Postgres returned. Going through
 * `Date` would cut it to milliseconds, and the next page would repeat or skip
 * the rows inside that millisecond.
 */
export interface Cursor {
  at: string | null
  id: string
}

export const encodeCursor = (cursor: Cursor): string =>
  Buffer.from(JSON.stringify(cursor)).toString('base64url')

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}(:\d{2})?)?$/

/**
 * A cursor the panel did not get from us — edited, truncated — is a 400, not a 500.
 *
 * Both values end up inside a PostgREST filter string, so their shape is
 * checked strictly: anything else could carry filter syntax of its own.
 */
export const decodeCursor = (value: string): Cursor => {
  try {
    const { at, id } = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    ) as Partial<Cursor>

    if (typeof id !== 'string' || !UUID.test(id)) throw new Error('malformed cursor id')

    if (at === null) return { at, id }

    if (typeof at !== 'string' || !TIMESTAMP.test(at)) throw new Error('malformed cursor time')

    return { at, id }
  } catch {
    throw new BadRequestException('La lista cambió mientras la recorrías. Recarga la página.')
  }
}
