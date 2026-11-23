import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import {
  type ApplyHeldReceiptInput,
  type DismissHeldReceiptInput,
  type HeldReceiptsQuery,
  applyHeldReceiptSchema,
  dismissHeldReceiptSchema,
  heldReceiptsQuerySchema,
} from '@cobra/contracts'
import { readCallerId } from '~/auth/caller'
import { RequireSession } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { HeldReceiptsService } from './held-receipts.service'

@ApiTags('Comprobantes pendientes')
@Controller('tenants/:tenantId/held-receipts')
@RequireSession()
export class HeldReceiptsController {
  constructor(private readonly heldReceipts: HeldReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Comprobantes retenidos, por resolver o ya resueltos' })
  list(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query(new ZodValidationPipe(heldReceiptsQuerySchema)) query: HeldReceiptsQuery,
  ) {
    return this.heldReceipts.list({ client: ctx.supabase, tenantId, query })
  }

  @Get('open-count')
  @ApiOperation({ summary: 'Cuántos comprobantes retenidos esperan a un asesor' })
  countOpen(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.heldReceipts.countOpen(ctx.supabase, tenantId)
  }

  @Post(':receiptId/apply')
  @ApiOperation({ summary: 'Registrar en Wisphub un comprobante retenido' })
  apply(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body(new ZodValidationPipe(applyHeldReceiptSchema)) input: ApplyHeldReceiptInput,
  ) {
    return this.heldReceipts.apply({
      client: ctx.supabase,
      userId: readCallerId(ctx.userClaims),
      tenantId,
      receiptId,
      input,
    })
  }

  @Post(':receiptId/dismiss')
  @ApiOperation({ summary: 'Descartar un comprobante retenido y avisarle al cliente por qué' })
  dismiss(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body(new ZodValidationPipe(dismissHeldReceiptSchema)) input: DismissHeldReceiptInput,
  ) {
    return this.heldReceipts.dismiss({
      client: ctx.supabase,
      userId: readCallerId(ctx.userClaims),
      tenantId,
      receiptId,
      note: input.note || undefined,
    })
  }
}
