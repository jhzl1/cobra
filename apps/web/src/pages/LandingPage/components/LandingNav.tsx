import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Button } from '~/components/ui/button'
import { cn } from '~/lib/utils'

interface LandingNavProps {
  isSignedIn: boolean
  onContact: () => void
}

/**
 * Transparent over the hero; once the page moves it gains a seam and a
 * backdrop, so the links stay legible over whatever scrolls under them.
 */
export const LandingNav = ({ isSignedIn, onContact }: LandingNavProps) => {
  const SECTIONS = [
    { href: '#how-it-works', label: 'Cómo funciona' },
    { href: '#features', label: 'Funciones' },
    { href: '#pricing', label: 'Precios' },
    { href: '#faq', label: 'Preguntas' },
  ] as const
  const [hasScrolled, setHasScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setHasScrolled(window.scrollY > 8)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-20 h-15 border-b border-transparent transition-colors duration-200',
        hasScrolled && 'border-border bg-background/85 backdrop-blur-md backdrop-saturate-125',
      )}
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center gap-8 px-4 sm:px-10">
        <a href="#top" aria-label="Wispay, inicio" className="rounded-sm">
          <img src="/logo.svg" alt="Wispay" className="h-5.5 w-auto" />
        </a>

        <nav aria-label="Secciones" className="hidden gap-1 md:flex">
          {SECTIONS.map((section) => (
            <a
              key={section.href}
              href={section.href}
              className="rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex gap-2">
          {isSignedIn ? (
            <Button asChild variant="secondary">
              <Link to="/panel">Ir al panel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/login">Iniciar sesión</Link>
              </Button>
              <Button variant="secondary" onClick={onContact}>
                Contactar
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
