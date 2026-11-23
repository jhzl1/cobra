import { Link } from '@tanstack/react-router'
import { ChevronDownIcon, CircleUserRoundIcon, KeyRoundIcon, LogOutIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { usePlatformIdentityQuery } from '~/hooks/queries/usePlatformIdentityQuery'
import { supabase } from '~/lib/supabase'

/**
 * Who is signed in, and the two things only that person can do about it.
 *
 * On a phone the trigger is the icon alone and the address moves into the
 * menu: the header has no room for both it and the alert controls.
 */
export const AccountMenu = () => {
  const identityQuery = usePlatformIdentityQuery()
  const email = identityQuery.data?.email ?? ''

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ghost" className="max-w-64" aria-label="Cuenta">
          <CircleUserRoundIcon />
          <span className="hidden truncate sm:inline">{email}</span>
          <ChevronDownIcon className="hidden text-muted-foreground sm:inline" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/change-password">
            <KeyRoundIcon />
            Cambiar contraseña
          </Link>
        </DropdownMenuItem>
        {/* The router's auth listener takes it to the login once the session is gone. */}
        <DropdownMenuItem onSelect={() => void supabase.auth.signOut()}>
          <LogOutIcon />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
