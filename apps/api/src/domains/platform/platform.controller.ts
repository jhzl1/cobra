import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import {
  type GrantRoleInput,
  type JobRunStatus,
  grantRoleSchema,
  jobRunStatusSchema,
} from '@cobra/contracts'
import { readCallerId } from '~/auth/caller'
import { RequirePlatformAdmin } from '~/auth/require-platform-admin.decorator'
import { RequireSession } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { PlatformService } from './platform.service'

@ApiTags('Plataforma')
@Controller('platform')
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  /**
   * Open to anyone with a session on purpose: this is the question the panel
   * asks to know whether to draw the platform section, and answering 403 to a
   * non-administrator would make "are you an administrator?" impossible to ask.
   */
  @Get('me')
  @RequireSession()
  @ApiOperation({ summary: 'Quién soy y si administro la plataforma' })
  identity(@SupabaseCtx() ctx: SupabaseContext) {
    const claims = ctx.userClaims as { id?: string; email?: string } | null

    return this.platform.identity(readCallerId(ctx.userClaims), claims?.email ?? null)
  }

  @Get('roles')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Concesiones de rol, activas y revocadas' })
  listGrants() {
    return this.platform.listGrants()
  }

  @Post('roles')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Otorgar un rol de plataforma por correo' })
  grant(
    @SupabaseCtx() ctx: SupabaseContext,
    @Body(new ZodValidationPipe(grantRoleSchema)) body: GrantRoleInput,
  ) {
    return this.platform.grant(readCallerId(ctx.userClaims), body)
  }

  @Get('tenants/:tenantId/job-runs')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Ejecuciones del worker para una empresa, por intento' })
  listJobRuns(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('status', new ZodValidationPipe(jobRunStatusSchema.optional())) status?: JobRunStatus,
  ) {
    return this.platform.listJobRuns({ client: ctx.supabase, tenantId, status })
  }

  @Get('errors')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Intentos fallidos de todas las empresas' })
  listErrors(@SupabaseCtx() ctx: SupabaseContext) {
    return this.platform.listErrors(ctx.supabase)
  }

  @Delete('roles/:grantId')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Revocar una concesión, conservando su historia' })
  revoke(@Param('grantId', ParseUUIDPipe) grantId: string) {
    return this.platform.revoke(grantId)
  }
}
