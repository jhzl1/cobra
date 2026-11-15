import { Body, Controller, ForbiddenException, Get, Param, Post, Query, Res } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Response } from 'express'
import { metaWebhookSchema } from '@cobra/contracts'
import { PublicRoute } from '~/auth/public-route.decorator'
import { WhatsappService } from './whatsapp.service'

/**
 * One route per tenant, not a single endpoint.
 *
 * `/wh/wa/:tenantSlug/:webhookToken` — Dualhook's Webhook Override makes Meta
 * deliver here, either directly or through an n8n flow that forwards the
 * identical body. Directly, Meta first checks the URL with a GET; through n8n,
 * n8n answers that check and only the POST arrives.
 *
 * ACCEPTED RISK (user, 2026-10-27): nothing authenticates the caller beyond the
 * opaque token in the path. Meta signs with Dualhook's app secret, which we do
 * not have, so `X-Hub-Signature-256` cannot be verified. Anyone who knows a
 * tenant's URL and its phone_number_id can inject events — and the agent
 * registers payments off them. Before production the route needs something
 * only the real sender can produce.
 *
 * Excluded from the docs on purpose: it is Meta's contract, not ours, and its
 * URL carries a secret.
 */
@ApiExcludeController()
@Controller('wh/wa')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /**
   * Meta's subscription check, sent when the URL is saved in Dualhook's Webhook
   * Override. The verify token is the route's own `webhookToken`: it already is
   * this URL's secret, and a second one would be one more value to store and to
   * show. The answer is the bare challenge, which is why it writes the response
   * itself instead of going through the `{ success, data }` envelope.
   */
  @Get(':tenantSlug/:webhookToken')
  @PublicRoute()
  async verify(
    @Param('tenantSlug') tenantSlug: string,
    @Param('webhookToken') webhookToken: string,
    @Query() query: Record<string, unknown>,
    @Res() response: Response,
  ): Promise<void> {
    await this.whatsapp.resolveRoute(tenantSlug, webhookToken)

    const challenge = query['hub.challenge']
    const isSubscription =
      query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === webhookToken

    if (!isSubscription || typeof challenge !== 'string') {
      throw new ForbiddenException(
        'El Verify Token tiene que ser el último tramo de la URL del webhook de este número.',
      )
    }

    response.type('text/plain').send(challenge)
  }

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
