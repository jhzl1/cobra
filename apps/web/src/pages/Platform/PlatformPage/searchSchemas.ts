import { z } from 'zod'
import { paginationSearchSchema } from '~/lib/searchSchemas'

/**
 * The companies tab is the default, so the URL only names the other three.
 * `catch` covers an unknown tab; the outer `default` covers a missing one and
 * is what keeps the key optional in links.
 */
export const platformTabSchema = z
  .enum(['companies', 'errors', 'models', 'users'])
  .catch('companies')
  .default('companies')

/** The page belongs to whichever list the open tab shows. */
export const platformSearchSchema = paginationSearchSchema.extend({ tab: platformTabSchema })
