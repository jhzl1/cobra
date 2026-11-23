import type { PostgrestError } from '@supabase/supabase-js'
import { type RangeResult, type RowRange, rangeOfPage, selectPage } from './pagination'

const TOTAL = 45

const toPosition = (row: Record<string, unknown>) => row['position'] as number

/** A table of 45 rows behind a fake PostgREST, which refuses a range past the end as the real one does. */
const fakeTable = () => {
  const rows = Array.from({ length: TOTAL }, (_, index) => ({ position: index }))
  const requested: RowRange[] = []

  const selectRange = async ({ from, to }: RowRange): Promise<RangeResult> => {
    requested.push({ from, to })

    if (from > 0 && from >= rows.length) {
      const error = { code: 'PGRST103', message: 'Requested range not satisfiable' }

      return { data: null, count: null, error: error as PostgrestError }
    }

    return { data: rows.slice(from, to + 1), count: rows.length, error: null }
  }

  return { selectRange, requested }
}

describe('rangeOfPage', () => {
  it('starts the first page at the first row', () => {
    expect(rangeOfPage(1)).toEqual({ from: 0, to: 19 })
  })

  it('places a middle page after the ones before it', () => {
    expect(rangeOfPage(2)).toEqual({ from: 20, to: 39 })
  })
})

describe('selectPage', () => {
  it('answers the first page with the total of the whole list', async () => {
    const { selectRange } = fakeTable()

    const { data } = await selectPage(1, selectRange, toPosition)

    expect(data?.items).toEqual(Array.from({ length: 20 }, (_, index) => index))
    expect(data?.total).toBe(TOTAL)
  })

  it('answers a middle page with its own rows', async () => {
    const { selectRange } = fakeTable()

    const { data } = await selectPage(2, selectRange, toPosition)

    expect(data?.items[0]).toBe(20)
    expect(data?.items).toHaveLength(20)
  })

  it('answers the last page with what is left', async () => {
    const { selectRange } = fakeTable()

    const { data } = await selectPage(3, selectRange, toPosition)

    expect(data?.items).toEqual([40, 41, 42, 43, 44])
  })

  // PostgREST answers 416 here; the panel must get rows to move to, not an error.
  it('answers a page past the end with no rows and the real total', async () => {
    const { selectRange, requested } = fakeTable()

    const { data, error } = await selectPage(99, selectRange, toPosition)

    expect(error).toBeNull()
    expect(data).toEqual({ items: [], total: TOTAL })
    expect(requested).toHaveLength(2)
  })

  it('passes any other failure through', async () => {
    const failure = { code: '42501', message: 'permission denied' } as PostgrestError

    const { data, error } = await selectPage(
      1,
      async () => ({ data: null, count: null, error: failure }),
      toPosition,
    )

    expect(data).toBeNull()
    expect(error).toBe(failure)
  })
})
