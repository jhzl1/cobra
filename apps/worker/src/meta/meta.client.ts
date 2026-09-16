import { META_GRAPH_URL } from '@cobra/contracts'

export interface MetaClientOptions {
  accessToken: string
  phoneNumberId: string
  baseUrl?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class MetaError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly body: unknown,
  ) {
    super(message)
    this.name = 'MetaError'
  }
}

/**
 * WhatsApp Cloud API, spoken to directly.
 *
 * Media is two calls, unlike Dualhook's single `/{media_id}/content`: the first
 * returns a short-lived URL, the second fetches the bytes from it with the same
 * bearer token. Skipping the token on the second call answers 401 with an HTML
 * body, which is a confusing way to find out.
 */
export class MetaClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: MetaClientOptions) {
    this.baseUrl = options.baseUrl ?? META_GRAPH_URL
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  /** Returns the `wamid`, which is what the delivery statuses come back keyed by. */
  async sendText(to: string, body: string): Promise<string | null> {
    const response = await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body },
    })

    return readWamid(response)
  }

  async sendImage(to: string, mediaId: string, caption: string): Promise<string | null> {
    const response = await this.post({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { id: mediaId, caption },
    })

    return readWamid(response)
  }

  /** The read receipt and the typing indicator, so the customer sees no silence. */
  async markAsRead(messageId: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
      typing_indicator: { type: 'text' },
    }).catch(() => undefined)
  }

  async downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mediaType: string }> {
    const metadata = (await this.request('GET', `/${mediaId}`)) as {
      url?: string
      mime_type?: string
    }

    if (!metadata.url) throw new MetaError(`Media ${mediaId} has no URL`, null, metadata)

    const response = await this.fetchImpl(metadata.url, {
      // The bytes live on a lookaside host that still wants the bearer token.
      headers: { Authorization: `Bearer ${this.options.accessToken}` },
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    if (!response.ok) {
      throw new MetaError(`Media download answered ${response.status}`, response.status, null)
    }

    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mediaType: metadata.mime_type ?? 'image/jpeg',
    }
  }

  private post(body: unknown): Promise<unknown> {
    return this.request('POST', `/${this.options.phoneNumberId}/messages`, body)
  }

  private async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    })

    const text = await response.text()
    const parsed = text ? safeJson(text) : null

    if (!response.ok) {
      throw new MetaError(
        `Meta ${method} ${path} answered ${response.status}`,
        response.status,
        parsed,
      )
    }

    return parsed
  }
}

const readWamid = (response: unknown): string | null => {
  const messages = (response as { messages?: Array<{ id?: string }> } | null)?.messages

  return messages?.[0]?.id ?? null
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
