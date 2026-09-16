import { useQuery } from '@tanstack/react-query'
import type { PlatformIdentity } from '@cobra/contracts'
import { api } from '~/lib/api'

/**
 * Whether the signed-in person administers the platform.
 *
 * Asked to the API, which reads the table, and not read off the token's `roles`
 * claim. A token lives up to an hour, so the claim can still say ADMIN for
 * someone revoked five minutes ago — and a panel that draws buttons the server
 * refuses is worse than one that draws none.
 *
 * For deciding what to show. What is allowed is decided by the API and by RLS,
 * every time.
 */
export const usePlatformIdentity = () =>
  useQuery({
    queryKey: ['platform', 'me'],
    queryFn: async () => {
      const { data } = await api.get<PlatformIdentity>('/platform/me')

      return data
    },
  })
