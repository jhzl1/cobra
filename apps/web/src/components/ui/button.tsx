import * as React from 'react'
import { type VariantProps, cva } from 'class-variance-authority'
import { Loader2Icon } from 'lucide-react'
import { Slot } from 'radix-ui'
import { cn } from '~/lib/utils'

/**
 * Two departures from the generated variants, both because the panel is dark.
 *
 * `disabled` gets a shape of its own instead of shadcn's global
 * `disabled:opacity-50`. On a dark theme the fill carries almost no information
 * — `--secondary` is 1.19:1 against the card — so a secondary button dimmed to
 * half opacity is the same object, fainter, and reads as switched off either
 * way. Here the disabled state loses its fill and its border and drops to
 * `--disabled-foreground`, so what separates the two is the border and the
 * label contrast (14.3:1 against 3.7:1), not the background.
 *
 * And the hover goes up, not down. `hover:bg-secondary/80` blends towards the
 * background, which is darker: the button dims exactly when the pointer says it
 * is live.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-disabled-foreground disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs not-disabled:hover:bg-primary/90 not-disabled:active:bg-primary/80',
        // The border is what delimits it: the fill alone is 1.19:1 against the
        // card, below the 3:1 that WCAG asks of a non-text boundary.
        secondary:
          'border border-secondary-border bg-secondary text-secondary-foreground shadow-xs not-disabled:hover:bg-secondary-hover not-disabled:active:bg-secondary-active',
        destructive:
          'border border-destructive/40 bg-destructive/15 text-destructive not-disabled:hover:bg-destructive/25 focus-visible:ring-destructive/40',
        outline:
          'border border-input bg-transparent shadow-xs not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground',
        ghost: 'not-disabled:hover:bg-accent not-disabled:hover:text-accent-foreground',
        link: 'text-foreground underline-offset-4 not-disabled:hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-xs': "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /** Disables the button and shows a spinner. shadcn has no equivalent. */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      aria-busy={loading || undefined}
      disabled={asChild ? undefined : disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* Slot takes exactly one child, so asChild and the spinner cannot mix. */}
      {loading && !asChild ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
