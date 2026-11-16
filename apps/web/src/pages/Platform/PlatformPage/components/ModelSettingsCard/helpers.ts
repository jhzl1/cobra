import {
  FALLBACK_MODEL_SETTING_KEYS,
  MODEL_SETTING_KEYS,
  type ModelOption,
  type ModelRole,
  type PlatformSetting,
  modelRoleSchema,
} from '@cobra/contracts'
import type { ModelRow } from './types'

export const ROLE_COPY: Record<ModelRole, { label: string; requirement: string }> = {
  agent: {
    label: 'Conversación con el cliente',
    requirement:
      'Solo se muestran modelos compatibles con herramientas, como el registro de pagos.',
  },
  vision: {
    label: 'Lectura de comprobantes',
    requirement:
      'Solo se muestran modelos capaces de leer imágenes y devolver datos estructurados.',
  },
}

export const toModelRows = (settings: PlatformSetting[]): ModelRow[] => {
  const rows: ModelRow[] = []

  for (const role of modelRoleSchema.options) {
    const key = MODEL_SETTING_KEYS[role]
    const setting = settings.find((candidate) => candidate.key === key)

    if (!setting) continue

    rows.push({
      key,
      role,
      isFallback: false,
      modelId: String(setting.value),
      updatedAt: setting.updatedAt,
    })

    const fallbackKey = FALLBACK_MODEL_SETTING_KEYS[role]

    if (!fallbackKey) continue

    // No row yet is the same as a removed fallback: the migration seeds none.
    const fallback = settings.find((candidate) => candidate.key === fallbackKey)
    const fallbackModelId = typeof fallback?.value === 'string' ? fallback.value : null

    rows.push({
      key: fallbackKey,
      role,
      isFallback: true,
      modelId: fallbackModelId,
      updatedAt: fallback?.updatedAt ?? null,
    })
  }

  return rows
}

export const labelOf = (row: ModelRow): string => {
  const label = ROLE_COPY[row.role].label

  return row.isFallback ? `Respaldo de la ${label.toLowerCase()}` : label
}

export const formatPrice = (option: ModelOption): string => {
  if (option.promptPricePerMillion === null || option.completionPricePerMillion === null) {
    return 'precio variable'
  }

  return `US$${option.promptPricePerMillion} / US$${option.completionPricePerMillion} por millón`
}
