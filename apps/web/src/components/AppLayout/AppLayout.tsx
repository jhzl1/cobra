import { Link, Outlet } from '@tanstack/react-router'
import { InboxProvider } from '~/contexts/InboxContext/InboxProvider'
import { AccountMenu } from './components/AccountMenu'
import { AlertControls } from './components/AlertControls'
import { SectionNav } from './components/SectionNav'

/**
 * The frame every signed-in screen renders inside.
 *
 * No company picker and no link to the platform: the administrator reaches a
 * company from the platform's list, and the brand goes back home, which `/`
 * resolves to the platform for an administrator and to the company otherwise.
 *
 * The inbox wraps the frame and not only the chat screen, because the whole
 * point is to notice a message while looking at something else.
 */
export const AppLayout = () => (
  <InboxProvider>
    <div className="flex h-dvh flex-col">
      <header className="flex h-13 shrink-0 items-center gap-2 border-b px-4">
        <h1 className="flex">
          <Link
            to="/panel"
            className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
          >
            <img src="/logo.svg" alt="Wispay" className="h-6 w-auto" />
          </Link>
        </h1>

        <div className="ml-auto flex items-center gap-1">
          <AlertControls />
          <span className="hidden px-2 font-mono text-xs text-muted-foreground sm:inline">
            v{__APP_VERSION__}
          </span>
          <AccountMenu />
        </div>
      </header>

      <SectionNav />

      <main className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  </InboxProvider>
)
