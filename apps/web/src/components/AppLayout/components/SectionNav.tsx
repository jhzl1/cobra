import { Link, useMatchRoute } from '@tanstack/react-router'
import { useInbox } from '~/contexts/InboxContext/useInbox'
import { useCurrentTenantQuery } from '~/hooks/queries/useCurrentTenantQuery'
import { cn } from '~/lib/utils'
import { TENANT_SECTIONS } from '../helpers'

/**
 * A company's own screens, drawn only while one is open.
 *
 * Links and not Tabs: each section is a route, so this has to be something the
 * browser can follow, open in a tab and go back from.
 */
export const SectionNav = () => {
  const currentTenantQuery = useCurrentTenantQuery()
  const { unreadCount } = useInbox()
  const matchRoute = useMatchRoute()
  const tenant = currentTenantQuery.data

  if (!tenant) return null

  return (
    <nav
      aria-label="Secciones"
      className="flex h-10.5 shrink-0 items-stretch gap-5 overflow-x-auto border-b [mask-image:linear-gradient(to_right,black_85%,transparent)] px-4 sm:[mask-image:none]"
    >
      {TENANT_SECTIONS.map((section) => {
        const isActive = !!matchRoute({
          to: section.to,
          params: { tenantId: tenant.id },
          fuzzy: true,
        })

        return (
          <Link
            key={section.to}
            to={section.to}
            params={{ tenantId: tenant.id }}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-1.5 text-sm whitespace-nowrap transition-colors outline-none',
              'focus-visible:text-foreground focus-visible:underline focus-visible:underline-offset-4',
              isActive
                ? 'text-foreground shadow-[inset_0_-2px_0_var(--foreground)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {section.label}
            {section.to === '/$tenantId/conversations' && unreadCount > 0 && (
              <span className="font-mono text-xs font-semibold text-foreground">
                {unreadCount}
                <span className="sr-only"> sin leer</span>
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
