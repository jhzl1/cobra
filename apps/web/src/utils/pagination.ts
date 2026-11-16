import { PAGE_SIZE } from '@cobra/contracts'

/** How many pages a list of `total` rows takes; never less than one, so an empty list is on page 1. */
export const pageCountOf = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE))
