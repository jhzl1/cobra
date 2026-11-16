import { useNavigate } from '@tanstack/react-router'
import { SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Input } from '~/components/ui/input'
import { useDebouncedValue } from '~/hooks/useDebouncedValue'

interface ConversationSearchProps {
  search: string | undefined
}

/**
 * The box types freely and the URL follows a moment after the operator stops,
 * so each key does not become a request and a history entry.
 */
export const ConversationSearch = ({ search }: ConversationSearchProps) => {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(search ?? '')
  const debouncedDraft = useDebouncedValue(draft, 300)

  useEffect(() => {
    const next = debouncedDraft.trim() || undefined

    if (next === search) return

    void navigate({
      to: '.',
      search: (previous: Record<string, unknown>) => ({ ...previous, q: next }),
      replace: true,
    })
  }, [debouncedDraft, search, navigate])

  return (
    <div className="relative border-b p-2">
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label="Buscar conversaciones"
        placeholder="Buscar por nombre, número o usuario"
        className="pl-8"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  )
}
