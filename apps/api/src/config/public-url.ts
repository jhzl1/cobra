import type { Request } from 'express'

/**
 * Where this API is reachable from outside, as a base with no trailing slash.
 *
 * The panel cannot work this out: it knows the address it calls, which behind a
 * tunnel or a proxy is not the address n8n has to reach. So the API says it,
 * and it derives it from the request it is answering — a tunnel rewrites `Host`
 * and sets `X-Forwarded-Proto`, so the pair is already the public one and an
 * operator changes nothing to test against ngrok.
 *
 * `PUBLIC_URL` wins when set, for the deployment where the API never sees the
 * host that fronts it.
 *
 * The forwarded headers are not trusted for anything but this. The value is
 * shown to an authenticated administrator to copy into n8n's forward node; it
 * never decides a redirect, a cookie or an authorisation.
 */
export const publicUrlOf = (request: Request, configuredUrl?: string): string => {
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '')

  const forwardedProto = firstHeaderValue(request.headers['x-forwarded-proto'])
  const forwardedHost = firstHeaderValue(request.headers['x-forwarded-host'])
  const host = forwardedHost ?? request.headers.host

  if (!host) return ''

  return `${forwardedProto ?? request.protocol ?? 'http'}://${host}`
}

/** A forwarded header can arrive as a list when more than one proxy wrote it. */
const firstHeaderValue = (value: string | string[] | undefined): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value

  return raw?.split(',')[0]?.trim() || undefined
}
