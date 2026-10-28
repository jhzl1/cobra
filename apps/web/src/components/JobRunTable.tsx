import { Link } from '@tanstack/react-router'
import type { JobRun } from '@cobra/contracts'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { attemptStateOf, formatAttempt, formatStartedAt, queueLabel } from '~/lib/job-runs'

interface Props {
  runs: (JobRun & { companyName?: string })[]
  /** The error tray mixes companies, so it says whose each row is. */
  showCompany?: boolean
  emptyText: string
}

/**
 * Attempts of worker jobs, newest first. Read only: what failed is fixed where
 * it failed, not from here.
 */
export const JobRunTable = ({ runs, showCompany = false, emptyText }: Props) => {
  const columnCount = showCompany ? 7 : 6

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cuándo</TableHead>
          {showCompany && <TableHead>Empresa</TableHead>}
          <TableHead>Qué corrió</TableHead>
          <TableHead>Intento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Error</TableHead>
          <TableHead> </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.length ? (
          runs.map((run) => {
            const state = attemptStateOf(run)

            return (
              <TableRow key={run.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {formatStartedAt(run.startedAt)}
                </TableCell>
                {showCompany && <TableCell className="font-medium">{run.companyName}</TableCell>}
                <TableCell>{queueLabel(run.queue)}</TableCell>
                <TableCell className="font-mono text-xs">{formatAttempt(run)}</TableCell>
                <TableCell>
                  <Badge variant={state.tone}>{state.label}</Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  {run.error && (
                    <p className="line-clamp-3 font-mono text-xs break-words whitespace-normal text-muted-foreground">
                      {run.error}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {run.conversationId && (
                    <div className="flex justify-end">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to="/platform/tenants/$companyId"
                          params={{ companyId: run.tenantId }}
                          search={{ tab: 'conversations', conversationId: run.conversationId }}
                        >
                          Ver conversación
                        </Link>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )
          })
        ) : (
          <TableRow>
            <TableCell colSpan={columnCount} className="h-20 text-center text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
