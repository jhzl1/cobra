/**
 * An account that belongs to no company yet. Only someone who is not an
 * administrator lands here — an administrator is sent to the platform.
 */
export const NoTenantPage = () => (
  <div className="flex flex-col items-start gap-2 p-4 md:p-6">
    <p className="text-sm text-muted-foreground">
      Tu cuenta aún no está asociada a ninguna empresa.
    </p>
    <p className="text-sm text-muted-foreground">
      Solicita al administrador de la plataforma que te agregue a una.
    </p>
  </div>
)
