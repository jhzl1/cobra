import { z } from 'zod'
import { paymentMethodSchema } from '@cobra/contracts'

/**
 * The sentinel for "no zone". Radix refuses an item with an empty value, and the
 * absence of a zone is a real choice the operator makes rather than a blank.
 */
export const ANY_ZONE = '__any__'

/**
 * `zone` and `wisphubId` are nullable in the contract and can only hold '' in an
 * input, so the form keeps them as plain strings and converts on submit. Their
 * length limits come across unchanged.
 */
export const paymentMethodFormSchema = paymentMethodSchema.pick({ paymentAddress: true }).extend({
  zone: z.string().max(80, 'La zona no puede superar los 80 caracteres'),
  // Both come from the Wisphub picker: the id is what a payment is registered
  // with, the name is what the panel and the agent call it.
  wisphubId: z.string().min(1, 'Selecciona la forma de pago de Wisphub correspondiente'),
  entityName: z.string().min(1, 'Selecciona la forma de pago de Wisphub correspondiente'),
})
