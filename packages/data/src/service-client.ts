import { type SupabaseClient, createClient } from '@supabase/supabase-js'

/**
 * The service-role client.
 *
 * It bypasses RLS entirely, which is the whole reason `TenantScope` exists: the
 * policies in @cobra/db protect the panel, not the processes that run with this
 * key.
 */
export const createServiceClient = (url: string, secretKey: string): SupabaseClient =>
  createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
