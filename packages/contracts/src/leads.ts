import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

const customerCountSchema = z.enum(['up-to-200', '201-800', '801-2000', 'over-2000'], {
  error: 'Elige cuántos clientes activos tiene tu empresa.',
})

export type CustomerCount = z.infer<typeof customerCountSchema>

/**
 * A demo request from the landing page form. The caps exist because anyone can
 * submit it: without them one request could store a megabyte of text.
 */
export const createLeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre.')
    .max(120, 'Escribe tu nombre en menos de 120 caracteres.'),
  company: z
    .string()
    .trim()
    .min(1, 'Escribe el nombre de tu empresa.')
    .max(120, 'Escribe el nombre de tu empresa en menos de 120 caracteres.'),
  whatsapp: z
    .string()
    .trim()
    .regex(
      /^\+?[\d\s]{8,18}$/,
      'Escribe el número con el indicativo del país, por ejemplo +57 300 000 0000.',
    ),
  email: z
    .email('Escribe un correo electrónico válido, por ejemplo nombre@empresa.com.')
    .max(254, 'Escribe un correo de menos de 254 caracteres.'),
  customerCount: customerCountSchema,
})

export type CreateLeadInput = z.infer<typeof createLeadSchema>

export const leadStatusSchema = z.enum(['new', 'contacted', 'discarded'])

export type LeadStatus = z.infer<typeof leadStatusSchema>

export const updateLeadStatusSchema = z.object({ status: leadStatusSchema })

export type UpdateLeadStatusInput = z.infer<typeof updateLeadStatusSchema>

/**
 * A demo request as `GET /platform/leads` lists it. The hash of the IP it came
 * from stays in the database: it only counts requests per hour.
 */
export interface Lead {
  id: string
  name: string
  company: string
  whatsapp: string
  email: string
  customerCount: CustomerCount
  status: LeadStatus
  createdAt: string
}
