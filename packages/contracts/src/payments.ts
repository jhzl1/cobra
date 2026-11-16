import { z } from 'zod'
import { type Page, pageQuerySchema } from './api'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/** Every tenant operates in Colombia today; "today" and "this month" are Bogotá's. */
const PAYMENTS_TIME_ZONE = 'America/Bogota'
/** Bogotá has no daylight saving, so the offset is fixed. */
const PAYMENTS_UTC_OFFSET = '-05:00'

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va en formato AAAA-MM-DD')

/**
 * The payments list: a page and a range of registration days, both inclusive.
 * A missing day falls back to the default range, the current month so far.
 */
export const paymentsQuerySchema = pageQuerySchema.extend({
  from: daySchema.optional(),
  to: daySchema.optional(),
})

export type PaymentsQuery = z.infer<typeof paymentsQuerySchema>

/** One payment registered in Wisphub through this app, by the agent or by hand. */
export interface Payment {
  id: string
  /** When Wisphub confirmed it, not the date printed on the receipt. */
  registeredAt: string
  kind: 'invoice_payment' | 'credit'
  amount: number
  documents: string[]
  invoiceIds: number[]
  /** An operator applied a held receipt from "Pendientes"; otherwise the agent did. */
  registeredBy: 'agent' | 'operator'
  conversationId: string
  contact: { displayName: string | null; phone: string | null }
  /** What was read off the receipt it came from. Null for a payment without one. */
  receipt: {
    amount: number | null
    references: string[]
    paidAt: string | null
    destinationMethod: string | null
    destinationAccount: string | null
    confidence: number | null
    description: string | null
    imageUrl: string | null
  } | null
}

export interface PaymentPage extends Page<Payment> {
  /** The sum of every payment in the range, not only this page's. */
  totalAmount: number
}

/**
 * The default range: from the first of the current month to today, in Bogotá.
 * Shared so the panel shows the same days the API filters by.
 */
export const defaultPaymentRange = (now: Date = new Date()): { from: string; to: string } => {
  const today = bogotaDayOf(now)

  return { from: `${today.slice(0, 8)}01`, to: today }
}

/**
 * The instants that bound a range of Bogotá days: the start of `from`, and the
 * start of the day after `to`, exclusive.
 */
export const paymentRangeBounds = (range: {
  from: string
  to: string
}): { start: string; end: string } => {
  const end = new Date(`${range.to}T00:00:00${PAYMENTS_UTC_OFFSET}`)
  end.setUTCDate(end.getUTCDate() + 1)

  return { start: `${range.from}T00:00:00${PAYMENTS_UTC_OFFSET}`, end: end.toISOString() }
}

/** A day as the panel's URL carries it, or absent when it is missing or unreadable. */
export const paymentDaySearchOf = (value: unknown): string | undefined => {
  const parsed = daySchema.safeParse(value)

  return parsed.success ? parsed.data : undefined
}

const bogotaDayOf = (instant: Date): string =>
  // `en-CA` writes the date as YYYY-MM-DD.
  new Intl.DateTimeFormat('en-CA', {
    timeZone: PAYMENTS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
