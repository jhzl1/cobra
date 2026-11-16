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
import { attemptStateOf, formatAttempt, formatStartedAt, queueLabel } from './helpers'

interface JobRunTableProps {
  runs: (JobRun & { companyName?: string })[]
  /** The error tray mixes companies, so it says whose each row is. */
  showCompany?: boolean
  emptyText: string
}

/**
 * Attempts of worker jobs, newest first. Read only: what failed is fixed where
 * it failed, not from here.
 */
export const JobRunTable = ({ runs, showCompany = false, emptyText }: JobRunTableProps) => {
  const columnCount = showCompany ? 7 : 6

  return (
    <Table className="min-w-[1100px]">
      <TableHeader>
        <TableRow>
          <TableHead className="w-44">Fecha</TableHead>
          {showCompany && <TableHead className="w-48">Empresa</TableHead>}
          <TableHead className="w-[17rem]">Proceso</TableHead>
          <TableHead className="w-28">Intento</TableHead>
          <TableHead className="w-52">Estado</TableHead>
          <TableHead>Error</TableHead>
          <TableHead className="w-40"> </TableHead>
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
                {showCompany && (
                  <TableCell className="truncate font-medium">{run.companyName}</TableCell>
                )}
                <TableCell>{queueLabel(run.queue)}</TableCell>
                <TableCell className="font-mono text-xs">{formatAttempt(run)}</TableCell>
                <TableCell>
                  <Badge variant={state.tone}>{state.label}</Badge>
                </TableCell>
                <TableCell>
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
