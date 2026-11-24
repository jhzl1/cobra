import type { CustomerCount } from '@cobra/contracts'

// The ranges follow the plans, so the answer already says which plan fits.
export const CUSTOMER_COUNT_OPTIONS = [
  { value: 'up-to-200', label: 'Hasta 200' },
  { value: '201-800', label: 'Entre 201 y 800' },
  { value: '801-2000', label: 'Entre 801 y 2.000' },
  { value: 'over-2000', label: 'Más de 2.000' },
] as const satisfies ReadonlyArray<{ value: CustomerCount; label: string }>
