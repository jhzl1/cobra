import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'
import type { CreateLeadInput, Lead, LeadStatus, Page } from '@cobra/contracts'
import { selectPage } from '~/common/pagination'
import { SupabaseService } from '~/supabase/supabase.service'

/** Enough for someone who mistyped twice; a script filling the table is cut off at the fourth. */
const LEADS_PER_IP_PER_HOUR = 3

const ONE_HOUR_MS = 3_600_000

const LEAD_COLUMNS = 'id, name, company, whatsapp, email, customer_count, status, created_at'

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name)

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * A demo request from the landing page. `unscoped` because the route is
   * public: there is no session to read with, and a lead belongs to no tenant.
   *
   * Counted against the database, not a counter in memory, because the API
   * restarts on every deploy. Two requests racing can both pass the count; that
   * lets a fourth row in, not a flood.
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
