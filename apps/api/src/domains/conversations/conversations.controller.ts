import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import {
  type HandoffInput,
  conversationSearchSchema,
  cursorSchema,
  handoffSchema,
  sendMessageSchema,
} from '@cobra/contracts'
import { readCallerId } from '~/auth/caller'
import { RequireSession } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { ConversationsService } from './conversations.service'

@ApiTags('Conversaciones')
@Controller('conversations')
@RequireSession()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bandeja de conversaciones de una empresa' })
  list(
    @SupabaseCtx() ctx: SupabaseContext,
    @Query('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('search', new ZodValidationPipe(conversationSearchSchema)) search?: string,
    @Query('cursor', new ZodValidationPipe(cursorSchema)) cursor?: string,
  ) {
    return this.conversations.list(ctx.supabase, { tenantId, search, cursor })
  }

  @Get(':conversationId')
  @ApiOperation({ summary: 'Una conversación, como la muestra la bandeja' })
  findOne(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.findSummary(ctx.supabase, conversationId)
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Mensajes de la conversación, de los más recientes hacia atrás' })
  listMessages(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('cursor', new ZodValidationPipe(cursorSchema)) cursor?: string,
  ) {
    return this.conversations.listMessages(ctx.supabase, { conversationId, cursor })
  }

  @Post(':conversationId/messages')
  @ApiOperation({ summary: 'Responder como operador' })
  send(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) input: { body: string },
  ) {
    return this.conversations.sendFromOperator({
      client: ctx.supabase,
      userId: readCallerId(ctx.userClaims),
      conversationId,
      body: input.body,
    })
  }

  @Post(':conversationId/handoff')
  @ApiOperation({ summary: 'Tomar el control, devolverlo, o reenviar al agente' })
  handoff(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body(new ZodValidationPipe(handoffSchema)) input: HandoffInput,
  ) {
    return this.conversations.handoff({
      client: ctx.supabase,
      userId: readCallerId(ctx.userClaims),
      conversationId,
      input,
    })
  }

  @Get(':conversationId/runs')
  @ApiOperation({ summary: 'Timeline: lo que hizo el agente, paso por paso' })
  listRuns(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.listRuns(ctx.supabase, conversationId)
  }
}
