const LAST_TENANT_KEY = 'cobra.tenant'

/**
 * The company last opened in this browser, so `/` can go back to it.
 *
 * Only a hint for where to land: which company is on screen is always the path.
 */
export const readLastTenantId = (): string | null => localStorage.getItem(LAST_TENANT_KEY)

export const saveLastTenantId = (tenantId: string): void => {
  localStorage.setItem(LAST_TENANT_KEY, tenantId)
}
