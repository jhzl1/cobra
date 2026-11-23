import type { CredentialProvider } from '@cobra/contracts'

export interface ProviderSpec {
  provider: CredentialProvider
  name: string
  purpose: string
  /** What the secret is called wherever the operator copied it from. */
  secretLabel: string
  /** Where to find it, so the label never has to be the vendor's field name. */
  secretHint: string
}
