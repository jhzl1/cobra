import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import {
  type MetaContact,
  type MetaMessage,
  type MetaWebhook,
  readContactId,
  readSenderId,
} from '@cobra/contracts'
import { CredentialsCryptoService } from '~/crypto/credentials-crypto.service'
import { QueueService } from '~/queue/queue.service'
import { SupabaseService } from '~/supabase/supabase.service'
import { isFresh, isSupportedType } from './inbound-filters'
import { verifyMetaSignature } from './signature'

export interface WebhookRoute {
  tenantId: string
  numberId: string
  phoneNumberId: string
  verifyToken: string
  appSecret: string | null
}

const UNIQUE_VIOLATION = '23505'

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name)

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
    private readonly crypto: CredentialsCryptoService,
  ) {}

  /**
   * Which tenant a request belongs to, from the path and nothing else.
   *
   * Resolving it from `metadata.phone_number_id` in an unauthenticated body
   * would mean that anyone who guesses a phone_number_id injects messages into
   * any client's conversation — and the agent registers payments in Wisphub off
   * those messages. The opaque token in the path closes that; the body is then
   * cross-checked against it.
   *
   * It is also what makes the GET handshake possible at all: Meta sends
   * `hub.verify_token` with no phone_number_id, so with a single URL there
   * would be no way to know which token to compare against.
   */
  async resolveRoute(slug: string, webhookToken: string): Promise<WebhookRoute> {
    const { data, error } = await this.supabase.admin
      .from('whatsapp_numbers')
      .select('id, tenant_id, phone_number_id, verify_token, tenants!inner (slug)')
      .eq('webhook_token', webhookToken)
      .is('valid_to', null)
      .maybeSingle()

    if (error) {
      this.logger.error(`Webhook route lookup failed: ${error.message}`)
      throw new NotFoundException()
    }

    const tenant = (Array.isArray(data?.tenants) ? data?.tenants[0] : data?.tenants) as
      | { slug: string }
      | undefined

    if (!data || tenant?.slug !== slug) {
      // Same answer for a wrong token and a wrong slug: anything more specific
      // turns this route into an oracle for guessing tokens.
      throw new NotFoundException()
    }

    return {
      tenantId: data.tenant_id as string,
      numberId: data.id as string,
      phoneNumberId: data.phone_number_id as string,
      verifyToken: data.verify_token as string,
      appSecret: await this.readAppSecret(data.tenant_id as string),
    }
  }

  /**
   * The signature check.
   *
   * When the tenant has loaded their app secret this is mandatory. When they
   * have not, the request is accepted on the strength of the path token alone
   * and the fact is logged — a deliberate, visible decision rather than a
   * silent one.
   */
  assertSignature(route: WebhookRoute, rawBody: Buffer, header: string | undefined): void {
    if (!route.appSecret) {
      this.logger.warn(
        `Tenant ${route.tenantId} has no Meta app secret loaded: the webhook is authenticated by its path token only`,
      )
      return
    }

    if (!verifyMetaSignature(rawBody, header, route.appSecret)) {
      throw new ForbiddenException()
    }
  }

  /**
   * Stores what arrived and queues the work. Persist first, answer second:
   * Meta retries anything that is not a 200, with backoff, for up to seven days.
   */
  async ingest(route: WebhookRoute, payload: MetaWebhook): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const { value } = change

        // `statuses` and `errors` share the envelope with messages and are most
        // of the traffic. They are handled apart, never fed to the pipeline.
        if (value.statuses?.length) {
          await this.applyStatuses(route, value.statuses)
          continue
        }

        if (value.errors?.length) {
          this.logger.warn(`Meta reported errors for ${route.tenantId}: ${JSON.stringify(value.errors)}`)
          continue
        }

        // Coexistence: what the business sent from the physical handset. Stored
        // so the panel shows the real chat, and never fed to the agent — the
        // loop that creates is the lesson netplus-bot left behind.
        if (value.message_echoes?.length) {
          await this.storeEchoes(route, value.message_echoes)
          continue
        }

        if (!value.messages?.length) continue

        const declared = value.metadata?.phone_number_id

        // The hard rule: the body's number has to be the route's number.
        if (declared && declared !== route.phoneNumberId) {
          throw new ForbiddenException()
        }

        await this.storeMessages(route, value.messages, value.contacts ?? [])
      }
    }
  }

  private async storeMessages(
    route: WebhookRoute,
    messages: MetaMessage[],
    contacts: MetaContact[],
  ): Promise<void> {
    for (const message of messages) {
      if (!isSupportedType(message) || !isFresh(message)) continue

      const senderId = readSenderId(message)

      if (!senderId) continue

      const profile = contacts.find((contact) => readContactId(contact) === senderId)
      const contactId = await this.upsertContact(route.tenantId, senderId, profile)
      const conversationId = await this.openConversation(route.tenantId, contactId)

      const { data, error } = await this.supabase.admin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          tenant_id: route.tenantId,
          direction: 'inbound',
          author: 'contact',
          type: message.type === 'image' ? 'image' : 'text',
          body: message.text?.body ?? message.image?.caption ?? null,
          media_id: message.image?.id ?? null,
          wamid: message.id,
          sent_at: new Date(Number(message.timestamp) * 1000).toISOString(),
        })
        .select('id')
        .single()

      if (error) {
        // Meta delivers at-least-once. A redelivery collides on `wamid`, which
        // is the whole point of that constraint, and is not an error here.
        if (error.code === UNIQUE_VIOLATION) continue

        throw error
      }

      /**
       * The image does not wait for the burst window: downloading it and
       * reading it with Gemini takes seconds, and those seconds run alongside
       * the text window instead of after it.
       */
      if (message.image?.id) {
        await this.queue.enqueueReceipt({
          tenantId: route.tenantId,
          conversationId,
          messageId: data.id as string,
          mediaId: message.image.id,
        })
      }

      await this.queue.enqueueTurn({ tenantId: route.tenantId, conversationId, trigger: 'inbound' })
    }
  }

  private async storeEchoes(route: WebhookRoute, echoes: MetaMessage[]): Promise<void> {
    for (const echo of echoes) {
      if (!isSupportedType(echo)) continue

      const recipient = readSenderId(echo)

      if (!recipient) continue

      const contactId = await this.upsertContact(route.tenantId, recipient)
      const conversationId = await this.openConversation(route.tenantId, contactId)

      await this.supabase.admin
        .from('messages')
        .insert({
          conversation_id: conversationId,
          tenant_id: route.tenantId,
          direction: 'outbound',
          author: 'operator',
          type: echo.type === 'image' ? 'image' : 'text',
          body: echo.text?.body ?? echo.image?.caption ?? null,
          media_id: echo.image?.id ?? null,
          wamid: echo.id,
          delivery_state: 'sent',
          // Outbound, so no turn ever consumes it.
          processed_at: new Date().toISOString(),
          sent_at: new Date(Number(echo.timestamp) * 1000).toISOString(),
        })
        .then(({ error }) => {
          if (error && error.code !== UNIQUE_VIOLATION) {
            this.logger.warn(`Could not store echo ${echo.id}: ${error.message}`)
          }
        })
    }
  }

  private async applyStatuses(
    route: WebhookRoute,
    statuses: Array<{ id: string; status: string; errors?: Array<{ code: number; title?: string }> }>,
  ): Promise<void> {
    for (const status of statuses) {
      const failed = status.status === 'failed'

      await this.supabase.admin
        .from('messages')
        .update({
          delivery_state: failed ? 'failed' : 'sent',
          delivery_error: failed ? JSON.stringify(status.errors ?? []) : null,
        })
        .eq('tenant_id', route.tenantId)
        .eq('wamid', status.id)
    }
  }

  private async upsertContact(
    tenantId: string,
    personId: string,
    profile?: MetaContact,
  ): Promise<string> {
    const { data, error } = await this.supabase.admin
      .from('contacts')
      .upsert(
        {
          tenant_id: tenantId,
          person_id: personId,
          // A username-era sender shares no number, so this stays null rather
          // than holding an internal identifier dressed as a phone.
          phone: /^\d+$/.test(personId) ? personId : null,
          display_name: profile?.profile?.name ?? null,
        },
        { onConflict: 'tenant_id,person_id' },
      )
      .select('id')
      .single()

    if (error) throw error

    return data.id as string
  }

  /**
   * The open conversation of this contact, or a new one.
   *
   * `tenant_id` is frozen here, when the conversation is created, and never
   * recalculated: a number that later moves to another tenant must not take
   * this history with it.
   */
  private async openConversation(tenantId: string, contactId: string): Promise<string> {
    const { data } = await this.supabase.admin
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('contact_id', contactId)
      .neq('status', 'closed')
      .maybeSingle()

    if (data) return data.id as string

    const created = await this.supabase.admin
      .from('conversations')
      .insert({ tenant_id: tenantId, contact_id: contactId, status: 'bot' })
      .select('id')
      .single()

    if (created.error) {
      // Two messages of the same burst racing for the first conversation. The
      // partial unique index rejects the second; the row it collided with is
      // the one to use.
      if (created.error.code === UNIQUE_VIOLATION) {
        const { data: existing } = await this.supabase.admin
          .from('conversations')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('contact_id', contactId)
          .neq('status', 'closed')
          .single()

        return existing?.id as string
      }

      throw created.error
    }

    return created.data.id as string
  }

  private async readAppSecret(tenantId: string): Promise<string | null> {
    const { data } = await this.supabase.admin
      .from('tenant_credentials')
      .select('ciphertext')
      .eq('tenant_id', tenantId)
      .eq('provider', 'meta')
      .maybeSingle()

    if (!data) return null

    try {
      return this.crypto.decrypt(data.ciphertext as string).extra?.['appSecret'] ?? null
    } catch {
      this.logger.error(`Could not decrypt the Meta credential of tenant ${tenantId}`)
      return null
    }
  }
}
