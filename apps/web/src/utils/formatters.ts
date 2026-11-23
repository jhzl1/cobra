export const formatPesos = (amount: number): string =>
  amount.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })

/**
 * A phone as WhatsApp shows it: `+57 300 1234567` for a Colombian mobile, and
 * the digits behind a plus for anything else, which is still the full number.
 */
export const formatPhone = (digits: string): string => {
  if (digits.length === 12 && digits.startsWith('57')) {
    return `+57 ${digits.slice(2, 5)} ${digits.slice(5)}`
  }

  return `+${digits}`
}

/** `16 nov 2026`. */
export const formatShortDate = (date: Date): string =>
  date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString('es-CO', { hour12: true })

/** `h:mm:ss` on a 24-hour clock. */
export const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

export const formatSeconds = (ms: number): string =>
  `${(ms / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} s`

/** Hours and minutes, or minutes alone under an hour. */
export const formatDuration = (ms: number): string => {
  const minutes = Math.floor(ms / 60_000)
  const hours = Math.floor(minutes / 60)

  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`
}

/** The time for something from today, the day and month for anything older. */
export const formatTimeOrDay = (iso: string | null): string => {
  if (!iso) return ''

  const date = new Date(iso)
  const isToday = new Date().toDateString() === date.toDateString()

  return isToday
    ? date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' })
}
