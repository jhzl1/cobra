/**
 * Dualhook's Runtime API. Same paths and bodies as Meta's Graph API, on
 * Dualhook's host, authenticated with the tenant's `dh_live_` key.
 */
export const DUALHOOK_API_URL = 'https://api.dualhook.com/v25.0'

const DEFAULT_TIMEOUT_MS = 20_000

/** Dualhook does not say what it sends; a receipt photographed on a phone is a JPEG. */
const FALLBACK_MEDIA_TYPE = 'image/jpeg'

export interface DualhookClientOptions {
  apiKey: string
  phoneNumberId: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class DualhookError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly body: unknown,
  ) {
    super(message)
    this.name = 'DualhookError'
  }
}

/**
 * WhatsApp through Dualhook, a Meta Tech Partner for Coexistence.
 *
 * The bearer is Dualhook's per-connection key, never a Meta token: Dualhook
 * holds the Meta side and adds `appsecret_proof` itself.
 *
 * Media is one call: `GET /{media_id}/content` answers the bytes. The `url` that
 * arrives in the webhook is useless here — downloading from it needs a Meta
 * access token that a Dualhook connection does not have.
 */
export class DualhookClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: DualhookClientOptions) {
    this.baseUrl = options.baseUrl ?? DUALHOOK_API_URL
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  /** Returns the `wamid`, which is what the delivery statuses come back keyed by. */
  async sendText(to: string, body: string): Promise<string | null> {
    const response = await this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    })

    return readWamid(response)
  }

  async sendImage(to: string, mediaId: string, caption: string): Promise<string | null> {
    const response = await this.postMessage({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { id: mediaId, caption },
    })

    return readWamid(response)
  }

  /** The read receipt and the typing indicator, so the customer sees no silence. */
  async markAsRead(wamid: string): Promise<void> {
    await this.postMessage({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: wamid,
      typing_indicator: { type: 'text' },
    }).catch(() => undefined)
  }

  async downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mediaType: string }> {
    const path = `/${mediaId}/content`
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: this.authHeaders(),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      const text = await response.text()

      throw new DualhookError(
        `Dualhook GET ${path} answered ${response.status}`,
        response.status,
        parseBody(text),
      )
    }

    const mediaType = response.headers.get('content-type')?.split(';')[0]?.trim()

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mediaType: mediaType || FALLBACK_MEDIA_TYPE,
    }
  }

  private async postMessage(body: unknown): Promise<unknown> {
    const path = `/${this.options.phoneNumberId}/messages`
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    const text = await response.text()
    const parsed = parseBody(text)

    if (!response.ok) {
      throw new DualhookError(
        `Dualhook POST ${path} answered ${response.status}`,
        response.status,
        parsed,
      )
    }

    return parsed
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.options.apiKey}` }
  }
}

const readWamid = (response: unknown): string | null => {
  const messages = (response as { messages?: Array<{ id?: string }> } | null)?.messages

  return messages?.[0]?.id ?? null
}

const parseBody = (text: string): unknown => {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
