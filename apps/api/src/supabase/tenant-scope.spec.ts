import type { SupabaseClient } from '@supabase/supabase-js'
import { TenantScope } from './tenant-scope'

const TENANT = '11111111-1111-1111-1111-111111111111'

/**
 * A client that records what was asked of it. The assertions below are the
 * reason `TenantScope` exists: the service role ignores RLS, so a query with no
 * `tenant_id` reads another client's conversations and nothing stops it.
 */
const buildClient = () => {
  const calls: Array<{ table: string; op: string; args: unknown }> = []

  const builder = (table: string, op: string, args: unknown) => {
    calls.push({ table, op, args })

    return {
      eq: (column: string, value: unknown) => {
        calls.push({ table, op: `eq:${column}`, args: value })
        return builder(table, `${op}.eq`, args)
      },
    }
  }

  const client = {
    from: (table: string) => ({
      select: (columns: string) => builder(table, 'select', columns),
      insert: (rows: unknown) => builder(table, 'insert', rows),
      update: (values: unknown) => builder(table, 'update', values),
      delete: () => builder(table, 'delete', null),
    }),
  } as unknown as SupabaseClient

  return { client, calls }
}

describe('TenantScope', () => {
  it('filters every select by tenant', () => {
    const { client, calls } = buildClient()

    new TenantScope(client, TENANT).select('conversations')

    expect(calls).toContainEqual({ table: 'conversations', op: 'eq:tenant_id', args: TENANT })
  })

  it('stamps the tenant on inserts, whatever the caller passed', () => {
    const { client, calls } = buildClient()

    new TenantScope(client, TENANT).insert('messages', {
      body: 'hola',
      tenant_id: '99999999-9999-9999-9999-999999999999',
    })

    expect(calls[0]?.args).toEqual([{ body: 'hola', tenant_id: TENANT }])
  })

  it('filters updates and deletes by tenant too', () => {
    const { client, calls } = buildClient()
    const scope = new TenantScope(client, TENANT)

    scope.update('conversations', { status: 'human' })
    scope.delete('receipts')

    const tenantFilters = calls.filter((call) => call.op === 'eq:tenant_id')

    expect(tenantFilters).toHaveLength(2)
    expect(tenantFilters.every((call) => call.args === TENANT)).toBe(true)
  })
})
