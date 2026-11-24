import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import type { Request } from 'express'
import {
  type CreateLeadInput,
  type PageQuery,
  type UpdateLeadStatusInput,
  createLeadSchema,
  pageQuerySchema,
  updateLeadStatusSchema,
} from '@cobra/contracts'
import { PublicRoute } from '~/auth/public-route.decorator'
import { RequirePlatformAdmin } from '~/auth/require-platform-admin.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { LeadsService } from './leads.service'

/** Demo requests: sent by anyone from the landing page, read by the platform. */
@ApiTags('Leads')
@Controller()
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  /**
   * The client IP comes from `X-Real-IP`, the one header Railway documents for
   * it. Without it every request would count against the proxy's address, and
   * three requests an hour would close the form for everyone.
   */
  @Post('leads')
  @PublicRoute()
  @ApiOperation({ summary: 'Solicitar una demostración desde la página principal' })
  create(
    @Body(new ZodValidationPipe(createLeadSchema)) body: CreateLeadInput,
    @Req() request: Request,
  ) {
    const realIp = request.headers['x-real-ip']
    const clientIp = typeof realIp === 'string' ? realIp : (request.ip ?? 'unknown')

    return this.leads.create({ lead: body, clientIp })
  }

  @Get('platform/leads')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Solicitudes de demostración, de la más reciente a la más antigua' })
  listPage(
    @SupabaseCtx() ctx: SupabaseContext,
    @Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery,
  ) {
    return this.leads.listPage(ctx.supabase, query.page)
  }

  @Patch('platform/leads/:leadId/status')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Marcar una solicitud como nueva, contactada o descartada' })
  setStatus(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body(new ZodValidationPipe(updateLeadStatusSchema)) body: UpdateLeadStatusInput,
  ) {
    return this.leads.setStatus(leadId, body.status)
  }
}
