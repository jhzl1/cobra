import type { PostgrestError } from '@supabase/supabase-js'
import { PAGE_SIZE, type Page } from '@cobra/contracts'
import type { QueryResult, Row } from '@cobra/data'

/** PostgREST's answer, with HTTP 416, to a range that starts past the last row. */
const RANGE_NOT_SATISFIABLE = 'PGRST103'

export interface RowRange {
  from: number
  /** Inclusive, the way `.range()` takes it. */
  to: number
}

export type RangeResult = QueryResult & { count: number | null }

export const rangeOfPage = (page: number): RowRange => {
  const from = (page - 1) * PAGE_SIZE

  return { from, to: from + PAGE_SIZE - 1 }
}

/**
 * One page of a list, and how many rows the whole list has.
 *
 * `selectRange` builds the query with `{ count: 'exact' }` and applies the
 * range it is given. A page past the end is not an error for the panel — it
 * answers with no rows and the real total, so the screen can move to the last
 * page — but PostgREST refuses that range with a 416 and no count. The total
 * is then asked for again with the first row only.
 */
export const selectPage = async <T>(
  page: number,
  selectRange: (range: RowRange) => PromiseLike<RangeResult>,
  toItem: (row: Row) => T,
): Promise<{ data: Page<T>; error: null } | { data: null; error: PostgrestError }> => {
  const response = await selectRange(rangeOfPage(page))

  if (response.error?.code === RANGE_NOT_SATISFIABLE) {
    const firstRow = await selectRange({ from: 0, to: 0 })

    if (firstRow.error) return { data: null, error: firstRow.error }

    return { data: { items: [], total: firstRow.count ?? 0 }, error: null }
  }

  if (response.error) return { data: null, error: response.error }

  const items = (response.data ?? []).map(toItem)

  return { data: { items, total: response.count ?? items.length }, error: null }
}
