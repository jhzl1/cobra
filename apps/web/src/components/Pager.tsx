import { PAGE_SIZE } from '@cobra/contracts'
import { Button } from '~/components/ui/button'

interface Props {
  page: number
  total: number
  onPageChange: (page: number) => void
}

/** How many pages a list of `total` rows takes; never less than one, so an empty list is on page 1. */
export const pageCountOf = (total: number): number => Math.max(1, Math.ceil(total / PAGE_SIZE))

/** Previous and next under a paginated table. Nothing to draw when the list fits in one page. */
export const Pager = ({ page, total, onPageChange }: Props) => {
  const pageCount = pageCountOf(total)

  if (pageCount === 1) return null

  return (
    <nav aria-label="Paginación" className="mt-4 flex items-center justify-end gap-2">
      <p className="mr-2 text-sm text-muted-foreground">
        Página {page} de {pageCount}
      </p>
      <Button
        size="sm"
        variant="secondary"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Anterior
      </Button>
      <Button
        size="sm"
        variant="secondary"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Siguiente
      </Button>
    </nav>
  )
}
