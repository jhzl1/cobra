import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { PlatformTenantPage } from '~/pages/Platform/PlatformTenantPage'
import { platformTenantSearchSchema } from '~/pages/Platform/PlatformTenantPage/searchSchemas'

/**
 * One company as the platform sees it.
 *
 * The param is `companyId` and not `tenantId` on purpose: the frame and the
 * inbox read `tenantId` from any route, and would take this screen for the
 * company's own panel — remembering it as the last one opened and alerting on
 * its incoming messages.
 */
export const Route = createFileRoute('/_app/_platform/platform_/tenants/$companyId')({
  search: {
    middlewares: [stripSearchParams({ page: 1, tab: 'conversations', status: 'open' })],
  },
  validateSearch: platformTenantSearchSchema,
  component: PlatformTenantPage,
})
