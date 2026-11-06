import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * Every response the API sends, success or failure, in one shape. The web client
 * unwraps it in a single interceptor instead of branching per endpoint.
 */
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; message: string; code?: string; details?: ApiFieldError[] }

export interface ApiFieldError {
  field: string
  message: string
}

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime().optional(),
})

export type Pagination = z.infer<typeof paginationSchema>

/**
 * Lists that grow without bound (companies, errors) go by numbered pages, so a
 * page number can live in the panel's URL and be shared or reloaded.
 */
export const PAGE_SIZE = 20

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
})

export type PageQuery = z.infer<typeof pageQuerySchema>

export interface Page<T> {
  items: T[]
  /** Every row the list has, not only this page's: the panel derives the page count from it. */
  total: number
}

/**
 * The page as the panel's URL carries it: page 1 is the default and never
 * written, so it and anything unreadable (0, negative, text) come back absent.
 */
export const pageSearchOf = (value: unknown): number | undefined => {
  const parsed = pageQuerySchema.shape.page.safeParse(value)

  return parsed.success && parsed.data > 1 ? parsed.data : undefined
}
