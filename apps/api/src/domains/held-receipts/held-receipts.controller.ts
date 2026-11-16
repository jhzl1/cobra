import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import {
  type ApplyHeldReceiptInput,
  type PageQuery,
  applyHeldReceiptSchema,
  pageQuerySchema,
} from '@cobra/contracts'
import { readCallerId } from '~/auth/caller'
import { RequireSession } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { HeldReceiptsService } from './held-receipts.service'

@ApiTags('Pendientes')
@Controller('tenants/:tenantId/held-receipts')
@RequireSession()
export class HeldReceiptsController {
  constructor(private readonly heldReceipts: HeldReceiptsService) {}

  @Get()
  @ApiOperation({ summary: 'Comprobantes retenidos sin resolver' })
  list(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ) {
    return this.heldReceipts.list(ctx.supabase, tenantId, query.page)
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
  @ApiOperation({ summary: 'Descartar un comprobante retenido sin registrar nada' })
  dismiss(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
  ) {
    return this.heldReceipts.dismiss({
      client: ctx.supabase,
      userId: readCallerId(ctx.userClaims),
      tenantId,
      receiptId,
    })
  }
}
