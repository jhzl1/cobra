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
