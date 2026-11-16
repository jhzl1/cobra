import type { TenantStatus } from '@cobra/contracts'

/** A company as the panel lists it: `GET /tenants` plus its member count. */
export interface TenantSummary {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: TenantStatus
  /** Replies stay in the panel: nothing reaches customers, the administrator or Wisphub. */
  dryRun: boolean
  memberCount: number
}
