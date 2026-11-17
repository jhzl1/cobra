import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import {
  type ChangePasswordInput,
  type CreateAccountInput,
  type PageQuery,
  type PasswordResetRequestInput,
  changePasswordSchema,
  createAccountSchema,
  pageQuerySchema,
  passwordResetRequestSchema,
} from '@cobra/contracts'
import { readCallerId } from '~/auth/caller'
import { PublicRoute } from '~/auth/public-route.decorator'
import { RequirePlatformAdmin } from '~/auth/require-platform-admin.decorator'
import { RequireSessionAllowingTemporaryPassword } from '~/auth/require-session.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { AccountsService } from './accounts.service'

/**
 * Who can sign in, and with which password.
 *
 * Accounts are only ever created here, by an administrator: sign-up is closed.
 * Every password an administrator sets is temporary, and the person replaces it
 * before doing anything else.
 */
@ApiTags('Cuentas')
@Controller()
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get('platform/users')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Todas las cuentas, con su rol, sus empresas y sus solicitudes' })
  listUsers(@Query(new ZodValidationPipe(pageQuerySchema)) query: PageQuery) {
    return this.accounts.listUsers(query.page)
  }

  @Get('platform/password-reset-requests/count')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Solicitudes de restablecimiento sin resolver' })
  countOpenResetRequests() {
    return this.accounts.countOpenResetRequests()
  }

  @Post('platform/admins')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Crear la cuenta de un administrador con una contraseña temporal' })
  createAdmin(
    @SupabaseCtx() ctx: SupabaseContext,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput,
  ) {
    return this.accounts.createAdmin({ email: body.email, issuedBy: readCallerId(ctx.userClaims) })
  }

  @Delete('platform/roles/:grantId')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Revocar el rol de administrador y bloquear la cuenta' })
  revokeAdmin(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('grantId', ParseUUIDPipe) grantId: string,
  ) {
    return this.accounts.revokeAdmin({ grantId, revokedBy: readCallerId(ctx.userClaims) })
  }

  @Post('platform/tenants/:tenantId/users')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Crear un usuario de la empresa con una contraseña temporal' })
  createCompanyUser(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput,
  ) {
    return this.accounts.createCompanyUser({
      tenantId,
      email: body.email,
      issuedBy: readCallerId(ctx.userClaims),
    })
  }

  @Post('platform/users/:userId/temporary-password')
  @RequirePlatformAdmin()
  @ApiOperation({ summary: 'Reemplazar la contraseña de una cuenta por una temporal' })
  issueTemporaryPassword(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.accounts.issueTemporaryPassword({ userId, issuedBy: readCallerId(ctx.userClaims) })
  }

  @Put('me/password')
  @RequireSessionAllowingTemporaryPassword()
  @ApiOperation({ summary: 'Cambiar la contraseña propia' })
  changePassword(
    @SupabaseCtx() ctx: SupabaseContext,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    return this.accounts.changePassword({
      userId: readCallerId(ctx.userClaims),
      password: body.password,
    })
  }

  /**
   * The same 202 whether the email has an account or not: telling them apart
   * would turn this form into a way to find out who uses Wispay.
   */
  @Post('password-reset-requests')
  @PublicRoute()
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Pedir a un administrador que restablezca la contraseña' })
  requestPasswordReset(
    @Body(new ZodValidationPipe(passwordResetRequestSchema)) body: PasswordResetRequestInput,
  ) {
    return this.accounts.requestPasswordReset(body.email)
  }
}
