import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { TooltipProvider } from '~/components/ui/tooltip'
import { queryClient } from '~/lib/queryClient'
import { router } from '~/lib/router'

export const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* A short delay so sweeping the pointer across a table does not flash
        every tooltip on its way. */}
    <TooltipProvider delayDuration={300}>
      <RouterProvider router={router} />
    </TooltipProvider>
  </QueryClientProvider>
)
