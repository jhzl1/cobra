import type { CursorPage } from '@cobra/contracts'

/**
 * The rows of every page loaded, in the order the pages are given, each one
 * once.
 *
 * A row can come back on two pages: the list moves while it is scrolled — a
 * conversation that receives a message jumps to the top — and a next page asked
 * for before the refetch lands starts from where the old order left off. Two
 * rows with one id would also be two React children with one key.
 */
export const itemsOfPages = <T extends { id: string }>(pages: CursorPage<T>[]): T[] => {
  const seenIds = new Set<string>()
  const items: T[] = []

  for (const page of pages) {
    for (const item of page.items) {
      if (seenIds.has(item.id)) continue

      seenIds.add(item.id)
      items.push(item)
    }
  }

  return items
}
