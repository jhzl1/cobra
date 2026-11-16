import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import type { WhatsappNumber } from '@cobra/contracts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import { CopyField } from '~/components/ui/copy-field'
import { useWhatsappNumbersQuery } from '~/hooks/queries/useWhatsappNumbersQuery'
import { WhatsappNumberDialog } from './components/WhatsappNumberDialog'
import { useRetireWhatsappNumberMutation } from './hooks/mutations/useRetireWhatsappNumberMutation'

interface WhatsappNumbersCardProps {
  tenantId: string
}

export const WhatsappNumbersCard = ({ tenantId }: WhatsappNumbersCardProps) => {
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false)
  const [numberToRetire, setNumberToRetire] = useState<WhatsappNumber | null>(null)
  const numbers = useWhatsappNumbersQuery(tenantId)
  const retire = useRetireWhatsappNumberMutation(tenantId)

  const active = numbers.data?.filter((number) => !number.validTo) ?? []
  const retired = numbers.data?.filter((number) => number.validTo) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Números de WhatsApp</CardTitle>
        <CardDescription>
          Al conectar un número se genera su URL de webhook, que debe configurarse en el Webhook
          Override de Dualhook. Su Verify Token corresponde al último segmento de esa URL.
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setIsConnectDialogOpen(true)}>
            <PlusIcon />
            Conectar número
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {active.length ? (
          active.map((number) => (
            <div key={number.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {number.displayNumber} · {number.phoneNumberId}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setNumberToRetire(number)}>
                  Dar de baja
                </Button>
              </div>
              <CopyField className="max-w-full" value={number.webhookUrl} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">
            No hay números conectados. La empresa no recibirá mensajes hasta que conectes uno; la
            URL de webhook se genera en ese momento.
          </p>
        )}

        {/* Retired numbers are kept in sight rather than hidden: their history is
            still here, and seeing one explains why its id can be reused. */}
        {retired.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {retired.map((number) => (
              <div key={number.id} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {number.displayNumber} · {number.phoneNumberId}
                </span>
                <Badge>Dado de baja</Badge>
              </div>
            ))}
          </div>
        )}

        {retire.error && <p className="text-sm text-destructive">{retire.error.message}</p>}
      </CardContent>

      {isConnectDialogOpen && (
        <WhatsappNumberDialog tenantId={tenantId} onClose={() => setIsConnectDialogOpen(false)} />
      )}

      <AlertDialog
        open={!!numberToRetire}
        onOpenChange={(open) => {
          if (!open) setNumberToRetire(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja {numberToRetire?.displayNumber}</AlertDialogTitle>
            <AlertDialogDescription>
              El número dejará de recibir mensajes y su URL de webhook quedará inactiva, por lo que
              debes retirarla del Webhook Override de Dualhook. Las conversaciones recibidas por
              este número se conservan y su identificador podrá registrarse de nuevo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                if (numberToRetire) {
                  retire.mutate(numberToRetire.id, { onSuccess: () => setNumberToRetire(null) })
                }
              }}
            >
              Dar de baja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
