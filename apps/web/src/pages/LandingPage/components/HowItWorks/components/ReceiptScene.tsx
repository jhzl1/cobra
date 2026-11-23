import { cn } from '~/lib/utils'
import { SceneCard } from './SceneCard'

export const ReceiptScene = () => {
  const FIELDS = [
    { label: 'Monto', value: '$ 75.000', isData: true },
    { label: 'Referencia', value: 'M8841207', isData: true },
    { label: 'Fecha', value: '22 nov 2026 · 10:38', isData: true },
    { label: 'Entidad', value: 'Nequi', isData: false },
    { label: 'Cuenta de destino', value: 'Conecta Fibra', isData: false },
  ] as const

  return (
    <SceneCard
      title="Comprobante"
      meta={
        <span className="flex items-center gap-1.5 text-success">
          <span className="size-2 rounded-full bg-success" />
          Válido
        </span>
      }
    >
      <dl>
        {FIELDS.map((field) => (
          <div
            key={field.label}
            className="grid grid-cols-[140px_1fr] border-b border-border last:border-b-0"
          >
            <dt className="px-4 py-3 text-[13px] text-muted-foreground">{field.label}</dt>
            <dd className={cn('px-4 py-3', field.isData && 'font-mono')}>{field.value}</dd>
          </div>
        ))}
      </dl>
    </SceneCard>
  )
}
