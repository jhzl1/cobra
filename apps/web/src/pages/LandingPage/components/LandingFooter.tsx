import { Link } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

interface LandingFooterProps {
  isSignedIn: boolean
}

export const LandingFooter = ({ isSignedIn }: LandingFooterProps) => {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border py-7 text-[13px] text-muted-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 sm:px-10">
        <img src="/logo.svg" alt="Wispay" className="h-4.5 w-auto opacity-90" />
        <span>© {year} Wispay</span>
        <Button asChild variant="ghost" size="sm">
          {isSignedIn && <Link to="/panel">Ir al panel</Link>}
        </Button>
      </div>
    </footer>
  )
}
