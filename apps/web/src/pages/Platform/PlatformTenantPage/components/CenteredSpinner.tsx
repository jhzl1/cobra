import { Spinner } from '~/components/ui/spinner'

/** A tab's own loading state, centred in whatever room the tab has. */
export const CenteredSpinner = () => (
  <div className="flex h-full min-h-20 items-center justify-center">
    <Spinner className="size-5" />
  </div>
)
