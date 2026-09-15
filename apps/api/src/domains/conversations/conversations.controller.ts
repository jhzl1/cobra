import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import { type HandoffInput, handoffSchema, sendMessageSchema } from '@cobra/contracts'
import { AuthClient } from '~/auth/auth-client.decorator'
import { readCallerId } from '~/auth/caller'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { ConversationsService } from './conversations.service'

@ApiTags('Conversaciones')
@Controller('conversations')
@AuthClient()
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'Bandeja de conversaciones de una empresa' })
  list(@SupabaseCtx() ctx: SupabaseContext, @Query('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.conversations.list(ctx.supabase, tenantId)
  }

  @Get(':conversationId/messages')
  @ApiOperation({ summary: 'Historial completo de la conversación' })
  messages(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.messages(ctx.supabase, conversationId)
  }

  @Post(':conversationId/messages')
  @ApiOperation({ summary: 'Responder como operador' })
  send(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body(new ZodValidationPipe(sendMessageSchema)) body: { body: string },
  ) {
    return this.conversations.sendFromOperator(
      ctx.supabase,
      readCallerId(ctx.userClaims),
      conversationId,
      body.body,
    )
  }

  @Post(':conversationId/handoff')
  @ApiOperation({ summary: 'Tomar el control, devolverlo, o reenviar al agente' })
  handoff(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body(new ZodValidationPipe(handoffSchema)) body: HandoffInput,
  ) {
    return this.conversations.handoff(
      ctx.supabase,
      readCallerId(ctx.userClaims),
      conversationId,
      body,
    )
  }

  @Get(':conversationId/runs')
  @ApiOperation({ summary: 'Timeline: lo que hizo el agente, paso por paso' })
  runs(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
  ) {
    return this.conversations.runs(ctx.supabase, conversationId)
  }
}
