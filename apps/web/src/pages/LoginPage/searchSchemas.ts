import { z } from 'zod'

/**
 * Where to go once signed in: the screen that sent here. Only a path inside
 * the panel — anything else, a `//host` included, is dropped, so a crafted
 * link cannot use the login to send someone to another site.
 */
export const loginSearchSchema = z.object({
  redirect: z
    .string()
    .refine((path) => path.startsWith('/') && !path.startsWith('//'))
    .optional()
    .catch(undefined),
})
