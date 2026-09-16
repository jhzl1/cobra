import { SetMetadata } from '@nestjs/common'

export const RAW_RESPONSE = 'rawResponse'

/**
 * Answers with exactly what the handler returned, outside the `{ success, data }`
 * envelope.
 *
 * It exists for one route: Meta's webhook handshake, which compares the body
 * byte for byte against the challenge it sent and rejects anything wrapped.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE, true)
