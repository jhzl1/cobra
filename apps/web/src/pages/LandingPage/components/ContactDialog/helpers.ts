import { z } from 'zod'
import { createLeadSchema } from '@cobra/contracts'

/**
 * The contract's schema with a looser `customerCount`: the select starts at
 * `''`, which the contract's enum cannot hold, so the form could not even
 * declare its default value. The submit parses with the contract itself.
 */
export const contactFormSchema = createLeadSchema.extend({
  customerCount: z.string().min(1, 'Elige cuántos clientes activos tiene tu empresa.'),
})
