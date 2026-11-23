import { z } from 'zod'

/**
 * The demo request. It lives here while the landing page is its only reader;
 * once the API stores these requests, it moves to `@cobra/contracts` so both
 * sides validate with the same schema.
 */
export const contactRequestSchema = z.object({
  name: z.string().trim().min(1, 'Escribe tu nombre.'),
  company: z.string().trim().min(1, 'Escribe el nombre de tu empresa.'),
  whatsapp: z
    .string()
    .trim()
    .regex(
      /^\+?[\d\s]{8,18}$/,
      'Escribe el número con el indicativo del país, por ejemplo +57 300 000 0000.',
    ),
  email: z.email('Escribe un correo electrónico válido, por ejemplo nombre@empresa.com.'),
  customerCount: z.string().min(1, 'Elige cuántos clientes activos tiene tu empresa.'),
})

// The ranges follow the plans, so the answer already says which plan fits.
export const CUSTOMER_COUNT_OPTIONS = [
  { value: 'up-to-200', label: 'Hasta 200' },
  { value: '201-800', label: 'Entre 201 y 800' },
  { value: '801-2000', label: 'Entre 801 y 2.000' },
  { value: 'over-2000', label: 'Más de 2.000' },
] as const
