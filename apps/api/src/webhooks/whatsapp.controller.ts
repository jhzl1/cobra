import { Body, Controller, ForbiddenException, Get, Headers, Param, Post, Query, Req } from '@nestjs/common'
import { ApiExcludeController } from '@nestjs/swagger'
import type { Request } from 'express'
import { metaWebhookSchema } from '@cobra/contracts'
import { PublicRoute } from '~/auth/public-route.decorator'
import { WhatsappService } from './whatsapp.service'

interface RawBodyRequest extends Request {
  rawBody?: Buffer
}

/**
 * One route per tenant, not a single endpoint.
 *
 * `/wh/wa/:tenantSlug/:webhookToken` — the reasons are in `resolveRoute`, and
 * they are the two that decide the shape of this whole controller: Meta's GET
 * handshake carries no phone_number_id, and resolving a tenant from an
 * unauthenticated body lets anyone inject messages into any client's chat.
 *
 * Excluded from the docs on purpose: it is Meta's contract, not ours, and its
 * URL carries a secret.
 */
@ApiExcludeController()
@Controller('wh/wa')
export class WhatsappController {
  constructor(private readonly whatsapp: WhatsappService) {}

  /**
   * The handshake Meta performs when the webhook URL is saved. It answers the
   * challenge as plain text — a JSON envelope here fails the verification.
   */
  @Get(':tenantSlug/:webhookToken')
  @PublicRoute()
  async verify(
    @Param('tenantSlug') tenantSlug: string,
    @Param('webhookToken') webhookToken: string,
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
  ): Promise<string> {
    const route = await this.whatsapp.resolveRoute(tenantSlug, webhookToken)

    if (mode !== 'subscribe' || verifyToken !== route.verifyToken) {
      throw new ForbiddenException()
    }

    return challenge
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
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() request: RawBodyRequest,
    @Body() body: unknown,
  ): Promise<{ received: true }> {
    const route = await this.whatsapp.resolveRoute(tenantSlug, webhookToken)

    // Over the exact bytes Meta sent. Re-serialising the parsed object breaks
    // the signature for every message with an accent.
    this.whatsapp.assertSignature(route, request.rawBody ?? Buffer.alloc(0), signature)

    const parsed = metaWebhookSchema.safeParse(body)

    // A shape we do not recognise is discarded with a 200. Answering 4xx would
    // make Meta redeliver it for a week.
    if (!parsed.success) return { received: true }

    await this.whatsapp.ingest(route, parsed.data)

    return { received: true }
  }
}
