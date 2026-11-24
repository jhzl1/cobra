import { type LeadStatus, leadStatusSchema } from '@cobra/contracts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { Spinner } from '~/components/ui/spinner'
import { TableCell, TableRow } from '~/components/ui/table'
import { CUSTOMER_COUNT_OPTIONS } from '~/utils/customerCount'
import { formatDateTime } from '~/utils/formatters'
import { usePlatformLeadsQuery } from '../hooks/queries/usePlatformLeadsQuery'

interface LeadRowsProps {
  page: number
  onStatusChange: (change: { leadId: string; status: LeadStatus }) => void
  isChangingStatus: boolean
}

export const LeadRows = ({ page, onStatusChange, isChangingStatus }: LeadRowsProps) => {
  const leads = usePlatformLeadsQuery(page)
  const LEAD_STATUS_LABELS = {
    new: 'Nuevo',
    contacted: 'Contactado',
    discarded: 'Descartado',
  } satisfies Record<LeadStatus, string>

  if (leads.isPending) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="h-20 text-center">
          <Spinner className="mx-auto" />
        </TableCell>
      </TableRow>
    )
  }

  if (leads.isError) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="h-20 text-center text-destructive">
          {leads.error.message}
        </TableCell>
      </TableRow>
    )
  }

  if (!leads.data.items.length) {
    return (
      <TableRow>
        <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
          No hay solicitudes todavía
        </TableCell>
      </TableRow>
    )
  }

  return leads.data.items.map((lead) => (
    <TableRow key={lead.id}>
      <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        {formatDateTime(lead.createdAt)}
      </TableCell>
      <TableCell className="truncate font-medium" title={lead.name}>
        {lead.name}
      </TableCell>
      <TableCell className="truncate" title={lead.company}>
        {lead.company}
      </TableCell>
      <TableCell>{lead.whatsapp}</TableCell>
      <TableCell className="truncate" title={lead.email}>
        {lead.email}
      </TableCell>
      <TableCell>
        {CUSTOMER_COUNT_OPTIONS.find((option) => option.value === lead.customerCount)?.label}
      </TableCell>
      <TableCell>
        <Select
          value={lead.status}
          disabled={isChangingStatus}
          onValueChange={(next) =>
            onStatusChange({ leadId: lead.id, status: leadStatusSchema.parse(next) })
          }
        >
          <SelectTrigger size="sm" aria-label={`Estado de ${lead.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {leadStatusSchema.options.map((status) => (
              <SelectItem key={status} value={status}>
                {LEAD_STATUS_LABELS[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  ))
}
