import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Meta's `X-Hub-Signature-256`, verified over the exact bytes of the body.
 *
 * PLAN.md lists "ask Dualhook whether they hand over the app secret" as the one
 * blocking risk. Talking to Meta directly settles it: the app secret is the
 * tenant's, stored beside the access token, so the signature can actually be
 * checked and the opaque token in the URL stops being the only authentication.
 *
 * The raw buffer is what matters. Re-serialising the parsed object produces
 * different bytes for any message with an accent — which here is nearly all of
 * them — and every one of those would be rejected.
 */
export const verifyMetaSignature = (
  rawBody: Buffer,
  header: string | undefined,
  appSecret: string,
): boolean => {
  if (!header?.startsWith('sha256=')) return false

  const received = Buffer.from(header.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', appSecret).update(rawBody).digest()

  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false, and a thrown comparison is a 500 instead of a 403.
  if (received.length !== expected.length) return false

  return timingSafeEqual(received, expected)
}
