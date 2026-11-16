import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { PlatformPage } from '~/pages/Platform/PlatformPage'
import { platformSearchSchema } from '~/pages/Platform/PlatformPage/searchSchemas'

export const Route = createFileRoute('/_app/_platform/platform')({
  search: { middlewares: [stripSearchParams({ page: 1, tab: 'companies' })] },
  validateSearch: platformSearchSchema,
  component: PlatformPage,
})
