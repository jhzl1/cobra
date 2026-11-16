import { z } from 'zod'
import { conversationSearchSchema } from '@cobra/contracts'

/**
 * What the operator typed in the search box, in the URL so a reload or a shared
 * link keeps the same results. Both conversation routes take it: opening a
 * result must not throw the search away.
 */
export const conversationsSearchSchema = z.object({ q: conversationSearchSchema.catch(undefined) })
