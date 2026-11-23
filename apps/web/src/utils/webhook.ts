/**
 * What goes in Dualhook's Verify Token field. The API checks Meta's verify
 * token against the last segment of the webhook URL, so the token is read off
 * the URL instead of being a second secret.
 */
export const verifyTokenOf = (webhookUrl: string): string =>
  new URL(webhookUrl).pathname.split('/').pop() ?? ''
