import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import { metaWebhookSchema } from '@cobra/contracts'
import { PublicRoute } from '~/auth/public-route.decorator'
import { WhatsappService } from './whatsapp.service'

/**
 * One route per tenant, not a single endpoint.
 *
 * `/wh/wa/:tenantSlug/:webhookToken` — Dualhook's Webhook Override makes Meta
 * deliver to a self-hosted n8n, which forwards the identical body here. Meta's
 * GET handshake is answered by n8n, so this route only takes the POST.
 *
 * ACCEPTED RISK (user, 2026-10-27): nothing authenticates the caller beyond the
 * opaque token in the path. Meta signs with Dualhook's app secret, which we do
 * not have, so `X-Hub-Signature-256` cannot be verified, and n8n adds nothing
 * of its own. Anyone who knows a tenant's URL and its phone_number_id can inject
 * events — and the agent registers payments off them. The fix is a shared
 * secret header between the forwarder and this route, once n8n is retired or
 * before production, whichever comes first.
 *
 * Excluded from the docs on purpose: it is Meta's contract, not ours, and its
 * URL carries a secret.
 */
@ApiExcludeController()
@Controller('wh/wa')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /**
   * Persist, then answer. Meta retries anything that is not a 200 with backoff
   * for up to seven days, so the 200 has to mean "stored", not "received".
   */
  @Post(':tenantSlug/:webhookToken')
  @PublicRoute()
  async receive(
    @Param('tenantSlug') tenantSlug: string,
    @Param('webhookToken') webhookToken: string,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const route = await this.whatsapp.resolveRoute(tenantSlug, webhookToken)

    const parsed = metaWebhookSchema.safeParse(body)

    // A shape we do not recognise is discarded with a 200. Answering 4xx would
    // make Meta redeliver it for a week.
    if (!parsed.success) return { received: true }

    await this.whatsapp.ingest(route, parsed.data)

    return { received: true }
  }
}
