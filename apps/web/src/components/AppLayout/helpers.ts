interface Section {
  to:
    | '/$tenantId/conversations'
    | '/$tenantId/pending'
    | '/$tenantId/payments'
    | '/$tenantId/setup'
    | '/$tenantId/settings'
  label: string
}

export const TENANT_SECTIONS: Section[] = [
  { to: '/$tenantId/conversations', label: 'Conversaciones' },
  { to: '/$tenantId/pending', label: 'Comprobantes pendientes' },
  { to: '/$tenantId/payments', label: 'Pagos registrados' },
  { to: '/$tenantId/setup', label: 'Puesta en marcha' },
  { to: '/$tenantId/settings', label: 'Configuración' },
]
