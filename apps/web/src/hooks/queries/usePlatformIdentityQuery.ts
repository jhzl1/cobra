import { useQuery } from '@tanstack/react-query'
import { platformIdentityQueryOptions } from '~/fetchers/queries/platformIdentityQueryOptions'

export const usePlatformIdentityQuery = () => useQuery(platformIdentityQueryOptions())
