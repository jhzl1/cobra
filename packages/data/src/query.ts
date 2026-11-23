import type { PostgrestError } from '@supabase/supabase-js'

export type Row = Record<string, unknown>

export interface QueryResult<T = Row> {
  data: T[] | null
  error: PostgrestError | null
}

export interface SingleResult<T = Row> {
  data: T | null
  error: PostgrestError | null
}

/**
 * The slice of PostgREST's builder this codebase actually uses.
 *
 * Supabase's own types are driven by a generated `Database` type. There is none
 * here — the tables are addressed by name — and without it the builder infers
 * its rows as an error sentinel that then poisons every `.map()` downstream.
 *
 * This interface is the trade: rows come back as `Record<string, unknown>` and
 * the repositories read their columns explicitly. When `db:types` starts
 * producing a `Database` type, this is the one place that has to change.
 */
export interface TenantQuery<T = Row> extends PromiseLike<QueryResult<T>> {
  select(columns?: string): TenantQuery<T>
  eq(column: string, value: unknown): TenantQuery<T>
  neq(column: string, value: unknown): TenantQuery<T>
  gt(column: string, value: unknown): TenantQuery<T>
  gte(column: string, value: unknown): TenantQuery<T>
  lt(column: string, value: unknown): TenantQuery<T>
  lte(column: string, value: unknown): TenantQuery<T>
  in(column: string, values: readonly unknown[]): TenantQuery<T>
  is(column: string, value: null | boolean): TenantQuery<T>
  not(column: string, operator: string, value: unknown): TenantQuery<T>
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TenantQuery<T>
  limit(count: number): TenantQuery<T>
  single(): PromiseLike<SingleResult<T>>
  maybeSingle(): PromiseLike<SingleResult<T>>
}
