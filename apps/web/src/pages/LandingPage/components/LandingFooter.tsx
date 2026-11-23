import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

interface LandingFooterProps {
  isSignedIn: boolean
}

export const LandingFooter = ({ isSignedIn }: LandingFooterProps) => (
  <footer className="border-t border-border py-7 text-[13px] text-muted-foreground">
    <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 sm:px-10">
      <img src="/logo.svg" alt="Wispay" className="h-4.5 w-auto opacity-90" />
      <span>
        © 2026 Wispay. Cobro por WhatsApp para proveedores de internet que facturan en Wisphub.
      </span>
      <Button asChild variant="ghost" size="sm">
        {isSignedIn ? (
          <Link to="/panel">Ir al panel</Link>
        ) : (
          <Link to="/login">Iniciar sesión</Link>
        )}
      </Button>
    </div>
  </footer>
)
