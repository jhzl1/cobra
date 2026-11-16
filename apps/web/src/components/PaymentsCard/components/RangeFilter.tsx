import { useNavigate } from '@tanstack/react-router'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { es } from 'react-day-picker/locale'
import { defaultPaymentRange } from '@cobra/contracts'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Label } from '~/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { formatShortDate } from '~/utils/formatters'
import type { PaymentRange } from '../types'

interface RangeFilterProps {
  range: PaymentRange
}

/**
 * The days in the URL. A day equal to the default range stays out of it, so
 * the plain address keeps meaning "this month so far" whenever it is opened.
 * Changing the range starts the list over on its first page.
 *
 * The first click starts a new range and the second one closes it, whatever was
 * selected before: extending the old range from where the operator clicked
 * would leave them guessing which end moved. Closing after one click keeps the
 * range that was there.
 */
export const RangeFilter = ({ range }: RangeFilterProps) => {
  const navigate = useNavigate()
  const fallback = defaultPaymentRange()
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const [isPicking, setIsPicking] = useState(false)

  const from = parseISO(range.from)
  const to = parseISO(range.to)

  const applyRange = (next: DateRange) => {
    const nextFrom = next.from ?? from
    const fromDay = format(nextFrom, 'yyyy-MM-dd')
    const toDay = format(next.to ?? nextFrom, 'yyyy-MM-dd')

    setIsOpen(false)
    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({
        ...previous,
        from: fromDay === fallback.from ? undefined : fromDay,
        to: toDay === fallback.to ? undefined : toDay,
        page: undefined,
      }),
    })
  }

  const handleOpenChange = (isNextOpen: boolean) => {
    setIsOpen(isNextOpen)
    setDraft({ from, to })
    setIsPicking(false)
  }

  const handleSelect = (next: DateRange | undefined, clickedDay: Date) => {
    if (!isPicking) {
      setDraft({ from: clickedDay, to: undefined })
      setIsPicking(true)

      return
    }

    // A second click on the same day can clear the range; that day is the range.
    applyRange(next ?? { from: clickedDay, to: clickedDay })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="payment-range">Fecha de registro</Label>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button
            id="payment-range"
            variant="secondary"
            className="w-fit justify-start font-normal"
          >
            <CalendarIcon />
            {formatShortDate(from)} – {formatShortDate(to)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            defaultMonth={from}
            selected={draft}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}
