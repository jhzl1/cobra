import type { TenantStatus } from '@cobra/contracts'

/** A company as the panel lists it: `GET /tenants` plus its member count. */
export interface TenantSummary {
  id: string
  slug: string
  companyName: string
  supportPhone: string
  adminPhone: string
  status: TenantStatus
  memberCount: number
}
