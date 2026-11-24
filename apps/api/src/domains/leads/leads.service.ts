import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { CreateLeadInput, CustomerCount, Lead, LeadStatus, Page } from '@cobra/contracts'
import { selectPage } from '~/common/pagination'
import { SupabaseService } from '~/supabase/supabase.service'

/** Enough for someone who mistyped twice; a script filling the table is cut off at the fourth. */
const LEADS_PER_IP_PER_HOUR = 3

const ONE_HOUR_MS = 3_600_000

const LEAD_COLUMNS = 'id, name, company, whatsapp, email, customer_count, status, created_at'

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

const RESEND_TIMEOUT_MS = 5_000

const LEAD_NOTIFICATION_SENDER = 'Wispay <notificaciones@wispay.co>'

/** Copied from the panel's options: the API cannot import from apps/web. */
const CUSTOMER_COUNT_LABELS = {
  'up-to-200': 'Hasta 200',
  '201-800': 'Entre 201 y 800',
  '801-2000': 'Entre 801 y 2.000',
  'over-2000': 'Más de 2.000',
} satisfies Record<CustomerCount, string>

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name)

  private readonly resendApiKey: string

  constructor(
    private readonly supabase: SupabaseService,
    config: ConfigService,
  ) {
    this.resendApiKey = config.getOrThrow<string>('RESEND_API_KEY')
  }

  /**
   * A demo request from the landing page. `unscoped` because the route is
   * public: there is no session to read with, and a lead belongs to no tenant.
   *
   * Counted against the database, not a counter in memory, because the API
   * restarts on every deploy. Two requests racing can both pass the count; that
   * lets a fourth row in, not a flood.
   *
   * A failed email does not fail the request: the lead is already stored, and
   * an error would make the visitor retry into the hourly limit.
   */
  async create({
    lead,
    clientIp,
  }: {
    lead: CreateLeadInput
    clientIp: string
  }): Promise<{ received: true }> {
    const ipHash = createHash('sha256').update(clientIp).digest('hex')
    const anHourAgo = new Date(Date.now() - ONE_HOUR_MS).toISOString()

    const { count, error: countError } = await this.supabase.unscoped
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('created_at', anHourAgo)

    if (countError) throw this.toHttpError(countError)

    if ((count ?? 0) >= LEADS_PER_IP_PER_HOUR) {
      throw new HttpException(
        'Recibimos demasiadas solicitudes desde tu conexión. Inténtalo de nuevo en una hora.',
        HttpStatus.TOO_MANY_REQUESTS,
      )
    }

    const { error } = await this.supabase.unscoped.from('leads').insert({
      name: lead.name,
      company: lead.company,
      whatsapp: lead.whatsapp,
      email: lead.email,
      customer_count: lead.customerCount,
      ip_hash: ipHash,
    })

    if (error) throw this.toHttpError(error)

    await this.notifyAdmins(lead)

    return { received: true }
  }

  /** Read with the caller's session: RLS lets only a platform administrator see leads. */
  async listPage(client: SupabaseClient, page: number): Promise<Page<Lead>> {
    const { data, error } = await selectPage(
      page,
      ({ from, to }) =>
        client
          .from('leads')
          .select(LEAD_COLUMNS, { count: 'exact' })
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      toLead,
    )

    if (error) throw this.toHttpError(error)

    return data
  }

  /**
   * Through `unscoped` because the table has no update policy: the API is the
   * only writer, and `RequirePlatformAdmin` on the route decides who calls it.
   */
  async setStatus(leadId: string, status: LeadStatus): Promise<Lead> {
    const { data, error } = await this.supabase.unscoped
      .from('leads')
      .update({ status })
      .eq('id', leadId)
      .select(LEAD_COLUMNS)
      .single()

    if (error) throw this.toHttpError(error)

    return toLead(data)
  }

  private async notifyAdmins(lead: CreateLeadInput): Promise<void> {
    // `unscoped` because the route is public, so there is no session to read
    // with, and `user_roles` belongs to no tenant.
    const { data: admins, error } = await this.supabase.unscoped
      .from('user_roles')
      .select('email')
      .eq('role', 'ADMIN')
      .is('revoked_at', null)
      .not('user_id', 'is', null)

    if (error) {
      this.logger.warn(
        `Demo request email skipped, administrators unreadable: Postgrest ${error.code}`,
      )

      return
    }

    const recipients: string[] = admins.map((admin) => admin.email)

    if (recipients.length === 0) {
      this.logger.warn('Demo request email skipped: no active platform administrator')

      return
    }

    const body = [
      `Nombre: ${lead.name}`,
      `Empresa: ${lead.company}`,
      `WhatsApp: ${lead.whatsapp}`,
      `Correo: ${lead.email}`,
      `Clientes activos: ${CUSTOMER_COUNT_LABELS[lead.customerCount]}`,
      '',
      'La solicitud ya está en la pestaña Leads de la plataforma.',
    ].join('\n')
    // Resend requires a `to`. The sender goes there and the administrators in
    // `bcc`, so no administrator sees who else received it.
    const email = {
      from: LEAD_NOTIFICATION_SENDER,
      to: [LEAD_NOTIFICATION_SENDER],
      bcc: recipients,
      reply_to: lead.email,
      subject: `Nueva solicitud de demostración: ${lead.company}`,
      text: body,
    }

    try {
      const response = await fetch(RESEND_EMAILS_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'wispay-api',
        },
        body: JSON.stringify(email),
      })

      if (!response.ok) {
        const reason = await response.text()

        this.logger.warn(
          `Demo request email rejected by Resend (${response.status}) for ${recipients.length} recipients: ${reason}`,
        )
      }
    } catch (failure) {
      const reason = failure instanceof Error ? failure.message : String(failure)

      this.logger.warn(`Demo request email not sent: ${reason}`)
    }
  }

  private toHttpError(error: PostgrestError): Error {
    if (error.code === 'PGRST116') {
      return new NotFoundException('La solicitud no existe o fue eliminada')
    }

    this.logger.error(`Postgrest ${error.code}: ${error.message}`)

    return new InternalServerErrorException('No fue posible completar la operación')
  }
}

/** Supabase answers with its column names, and the panel reads the contract. */
const toLead = (row: Record<string, unknown>): Lead => ({
  id: row['id'] as string,
  name: row['name'] as string,
  company: row['company'] as string,
  whatsapp: row['whatsapp'] as string,
  email: row['email'] as string,
  customerCount: row['customer_count'] as Lead['customerCount'],
  status: row['status'] as LeadStatus,
  createdAt: row['created_at'] as string,
})
