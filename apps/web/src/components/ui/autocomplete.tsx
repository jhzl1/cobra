import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { Command, CommandEmpty, CommandItem, CommandList } from '~/components/ui/command'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

export interface AutocompleteOption {
  value: string
  label: string
  /** Secondary text on the right of the option, such as a price. */
  detail?: string
}

interface Props extends Omit<
  React.ComponentProps<typeof Input>,
  'value' | 'defaultValue' | 'onChange' | 'role'
> {
  options: AutocompleteOption[]
  value: string
  onValueChange: (value: string) => void
  /** What the list says when nothing matches what was typed. */
  emptyText: string
}

const filterOptions = (options: AutocompleteOption[], query: string): AutocompleteOption[] => {
  const needle = query.trim().toLowerCase()

  if (!needle) return options

  return options.filter(
    (option) =>
      option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle),
  )
}

/**
 * A text field that suggests as you type, for lists too long to scroll.
 *
 * The field shows the chosen option's label until it is focused; typing then
 * filters by label and by value. Picking is the only way to change the value:
 * free text that matches nothing is dropped on close, so the form can never
 * hold something that is not in `options`.
 *
 * The list is not portaled on purpose. Inside a modal dialog, Radix locks
 * scrolling to the dialog's own subtree, and a portaled list would not scroll
 * with the wheel.
 */
export const Autocomplete = ({
  options,
  value,
  onValueChange,
  emptyText,
  placeholder,
  disabled,
  className,
  ...props
}: Props) => {
  const listId = React.useId()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [query, setQuery] = React.useState('')
  const [isOpen, setIsOpen] = React.useState(false)
  // The option the keyboard is on. cmdk owns the arrows and Enter; this only
  // puts it back on a sensible option each time the list changes.
  const [highlighted, setHighlighted] = React.useState('')

  const selected = options.find((option) => option.value === value)
  const visible = filterOptions(options, query)

  const open = () => {
    if (disabled || isOpen) return

    setQuery('')
    setHighlighted(value)
    setIsOpen(true)
  }

  const choose = (next: string) => {
    onValueChange(next)
    setIsOpen(false)
  }

  return (
    <Command
      shouldFilter={false}
      value={highlighted}
      onValueChange={setHighlighted}
      className={cn('h-auto overflow-visible bg-transparent', className)}
    >
      <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
        <PopoverPrimitive.Anchor asChild>
          <Input
            ref={inputRef}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            disabled={disabled}
            value={isOpen ? query : (selected?.label ?? '')}
            placeholder={isOpen ? (selected?.label ?? placeholder) : placeholder}
            onFocus={open}
            onClick={open}
            onChange={(event) => {
              const nextQuery = event.target.value
              const [first] = filterOptions(options, nextQuery)

              setQuery(nextQuery)
              setHighlighted(first?.value ?? '')
              setIsOpen(true)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') open()
            }}
            {...props}
          />
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          // Focus stays in the field so typing keeps filtering.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            // A click on the field itself is not "outside"; closing there would
            // reopen it on the same click through `onClick`.
            if (inputRef.current?.contains(event.target as Node)) event.preventDefault()
          }}
          className="z-50 w-(--radix-popover-trigger-width) rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-hidden"
        >
          <CommandList id={listId}>
            <CommandEmpty>{emptyText}</CommandEmpty>

            {visible.map((option) => (
              <CommandItem key={option.value} value={option.value} onSelect={choose}>
                <CheckIcon className={cn(option.value === value ? 'opacity-100' : 'opacity-0')} />
                <span className="truncate">{option.label}</span>
                {option.detail && (
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {option.detail}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandList>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Root>
    </Command>
  )
}
