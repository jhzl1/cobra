interface PageLoadingBarProps {
  isLoading: boolean
}

/**
 * Above a paginated table, while the next page loads. The rows of the previous
 * page stay on screen meanwhile, so without it a click on "Siguiente" looked
 * like it did nothing. The bar keeps its height when idle: appearing must not
 * push the table down.
 */
export const PageLoadingBar = ({ isLoading }: PageLoadingBarProps) => (
  <div
    role={isLoading ? 'progressbar' : undefined}
    aria-label={isLoading ? 'Cargando la página' : undefined}
    className="relative h-0.5 overflow-hidden rounded-full"
  >
    {isLoading && <div className="absolute inset-y-0 w-1/3 animate-page-load bg-foreground/70" />}
  </div>
)
