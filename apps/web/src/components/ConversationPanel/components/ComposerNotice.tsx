interface ComposerNoticeProps {
  sendBlockedReason: string | null
  isServiceWindowClosed: boolean
  isAgentAnswering: boolean
}

/** Why the composer is locked, when it is. Only the most pressing reason shows. */
export const ComposerNotice = ({
  sendBlockedReason,
  isServiceWindowClosed,
  isAgentAnswering,
}: ComposerNoticeProps) => {
  if (sendBlockedReason !== null) {
    return <p className="text-xs text-muted-foreground">{sendBlockedReason}</p>
  }

  if (isServiceWindowClosed) {
    return (
      <p className="text-xs text-destructive">
        Han pasado más de 24 horas desde el último mensaje del cliente. WhatsApp solo permite
        contactarlo con una plantilla aprobada.
      </p>
    )
  }

  if (!isAgentAnswering) return null

  return (
    <p className="text-xs text-muted-foreground">
      El agente está atendiendo esta conversación. Toma el control para responder.
    </p>
  )
}
