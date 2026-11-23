import { Spinner } from '~/components/ui/spinner'

/** What a screen shows while it finds out whether it may be shown at all. */
export const PageSpinner = () => (
  <div className="flex flex-1 items-center justify-center">
    <Spinner className="size-6" />
  </div>
)
