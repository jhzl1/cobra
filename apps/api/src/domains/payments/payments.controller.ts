import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import { type PaymentsQuery, paymentsQuerySchema } from '@cobra/contracts'
import { RequireSession } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { PaymentsService } from './payments.service'

@ApiTags('Pagos')
@Controller('tenants/:tenantId/payments')
@RequireSession()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @ApiOperation({ summary: 'Pagos registrados en Wisphub por esta app, por fecha de registro' })
  list(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query(new ZodValidationPipe(paymentsQuerySchema)) query: PaymentsQuery,
  ) {
    return this.payments.list(ctx.supabase, tenantId, query)
  }
}
