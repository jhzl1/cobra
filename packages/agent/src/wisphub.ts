import type { WisphubCustomer, WisphubInvoice, WisphubPort } from './types'
import { formatCop } from './normalize'

const WISPHUB_BASE_URL = 'https://api.wisphub.net'

export interface WisphubClientOptions {
  apiKey: string
  baseUrl?: string
  /** Kept short on purpose: a hung call here is a customer left without an answer. */
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class WisphubError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly body: unknown,
  ) {
    super(message)
    this.name = 'WisphubError'
  }
}

/**
 * Wisphub's REST API.
 *
 * The trailing slashes are inconsistent and that inconsistency is load-bearing:
 * `/saldo` has none, `/perfil/` and `/registrar-pago/` do. Wisphub answers a 301
 * to the other spelling and the redirect drops the body on a POST, so a payment
 * sent to `/registrar-pago` silently registers nothing.
 */
export class WisphubClient implements WisphubPort {
  private readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch

  constructor(private readonly options: WisphubClientOptions) {
    this.baseUrl = options.baseUrl ?? WISPHUB_BASE_URL
    this.timeoutMs = options.timeoutMs ?? 20_000
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async lookupCustomer(document: string): Promise<WisphubCustomer> {
    const found = await this.request<{ results?: Array<Record<string, unknown>> }>(
      'GET',
      `/api/clientes?cedula=${encodeURIComponent(document)}`,
    ).catch(() => null)

    const first = found?.results?.[0]

    if (!first) {
      return emptyCustomer(document, `No existe ningún cliente registrado con el documento ${document}.`)
    }

    const serviceId = Number(first['id_servicio'])
    const zone = readZone(first)

    // No trailing slash. See the class comment.
    const balance = await this.request<{ nombre?: string; facturas?: WisphubInvoice[]; saldo?: number }>(
      'GET',
      `/api/clientes/${serviceId}/saldo`,
    )

    const invoices = Array.isArray(balance.facturas) ? balance.facturas : []
    const totalDebtRaw = Number(balance.saldo ?? 0)

    return {
      found: true,
      documentNumber: String(first['cedula'] ?? document),
      customerName: balance.nombre ?? String(first['nombre'] ?? ''),
      serviceId,
      zone,
      invoices,
      hasInvoices: invoices.length > 0,
      invoicesCount: invoices.length,
      totalDebt: formatCop(totalDebtRaw),
      totalDebtRaw,
      paymentMethods: [],
    }
  }

  getProfile(serviceId: number): Promise<{ saldo?: string | number }> {
    return this.request('GET', `/api/clientes/${serviceId}/perfil/`)
  }

  registerInvoicePayment(
    invoiceId: number,
    body: {
      referencia: string
      fecha_pago: string
      total_cobrado: number
      accion: 1
      forma_pago: string
    },
  ): Promise<unknown> {
    return this.request('POST', `/api/facturas/${invoiceId}/registrar-pago/`, body)
  }

  updateBalance(serviceId: number, saldo: string): Promise<unknown> {
    return this.request('PUT', `/api/clientes/${serviceId}/perfil/`, { saldo })
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Api-Key ${this.options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })

      const text = await response.text()
      const parsed = text ? safeJson(text) : null

      if (!response.ok) {
        throw new WisphubError(`Wisphub ${method} ${path} answered ${response.status}`, response.status, parsed)
      }

      return parsed as T
    } finally {
      clearTimeout(timer)
    }
  }
}

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const readZone = (row: Record<string, unknown>): string | undefined => {
  const zona = row['zona']

  if (zona && typeof zona === 'object' && 'nombre' in zona) {
    return String((zona as { nombre: unknown }).nombre)
  }

  return typeof zona === 'string' ? zona : undefined
}

export const emptyCustomer = (document: string, message: string): WisphubCustomer => ({
  found: false,
  message,
  documentNumber: document,
  invoices: [],
  hasInvoices: false,
  invoicesCount: 0,
  totalDebt: formatCop(0),
  totalDebtRaw: 0,
  paymentMethods: [],
})
