import { Button } from '~/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

interface IconButtonProps extends React.ComponentProps<typeof Button> {
  /** Shown in the tooltip, and read by a screen reader unless `aria-label` says more. */
  label: string
}

/**
 * The action column of a table: an icon, with what it does in a tooltip.
 *
 * Text buttons made that column wider than the data beside it, and a row with
 * two actions pushed the next column. `aria-label` defaults to the tooltip's
 * text, so the icon is never the only thing a screen reader gets.
 */
export const IconButton = ({ label, ...buttonProps }: IconButtonProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button size="icon-sm" variant="ghost" aria-label={label} {...buttonProps} />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)
