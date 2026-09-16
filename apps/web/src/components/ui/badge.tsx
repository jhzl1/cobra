import * as React from 'react'
import { type VariantProps, cva } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '~/lib/utils'

/**
 * Every tone is tinted rather than solid — HeroUI's `variant="flat"`, which is
 * the only one the panel ever used. A solid badge on a dark surface competes
 * with the primary action, and the panel puts up to three of them on one row.
 *
 * `success` and `warning` are ours: shadcn only ships `destructive`, and the
 * timeline maps four agent states onto colour.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3',
  {
    variants: {
      variant: {
        default: 'bg-muted text-muted-foreground',
        success: 'bg-success/15 text-success',
        warning: 'bg-warning/15 text-warning',
        destructive: 'bg-destructive/15 text-destructive',
        solid: 'bg-primary text-primary-foreground',
        outline: 'border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

/** The tones a call site may pass, so status maps can be typed against it. */
export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['variant']>

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
