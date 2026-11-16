import type { WhatsappNumber } from '@cobra/contracts'
import { CopyField } from '~/components/ui/copy-field'
import { verifyTokenOf } from '~/utils/webhook'
import { OverviewRow } from './OverviewRow'

interface ActiveNumberDetailsProps {
  number: WhatsappNumber
}

/**
 * The two values that go in the number's Webhook Override in Dualhook. The
 * platform sets that up, so it sees them here without entering the company.
 */
export const ActiveNumberDetails = ({ number }: ActiveNumberDetailsProps) => (
  <div className="flex flex-col gap-2 py-1">
    <OverviewRow label={number.displayNumber} value={number.phoneNumberId} />
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Webhook URL</p>
      <CopyField className="max-w-full" value={number.webhookUrl} />
    </div>
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">Verify Token</p>
      <CopyField className="max-w-full" value={verifyTokenOf(number.webhookUrl)} />
    </div>
  </div>
)
