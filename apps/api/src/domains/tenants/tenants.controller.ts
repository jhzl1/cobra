import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SupabaseContext } from '@supabase/server'
import { SupabaseCtx } from '@supabase/server/adapters/nestjs'
import type { Request } from 'express'
import {
  createTenantSchema,
  paymentMethodSchema,
  registerWhatsappNumberSchema,
  saveCredentialSchema,
  updateTenantSchema,
  updateTenantStatusSchema,
} from '@cobra/contracts'
import { AuthClient } from '~/auth/auth-client.decorator'
import { readCallerId } from '~/auth/caller'
import { RequireAdmin } from '~/auth/require-admin.decorator'
import { ZodValidationPipe } from '~/common/pipes/zod-validation.pipe'
import { publicUrlOf } from '~/config/public-url'
import { TenantsService } from './tenants.service'

/**
 * One role, on purpose: every member of a tenant may see the conversations,
 * take a handoff, load credentials and edit the company's configuration. The
 * decision is in PLAN.md, and a role model would be one more thing to get wrong
 * for no product value today.
 */
@ApiTags('Empresas')
@Controller('tenants')
@AuthClient()
export class TenantsController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar las empresas del usuario' })
  list(@SupabaseCtx() ctx: SupabaseContext) {
    return this.tenants.listMine(ctx.supabase)
  }

  /**
   * Only whoever administers the platform. Until this gate existed, anyone with
   * a session could create a company and became its member — the only thing
   * holding that back was that sign-up is closed.
   */
  @Post()
  @RequireAdmin()
  @ApiOperation({ summary: 'Crear una empresa y quedar como miembro' })
  create(
    @SupabaseCtx() ctx: SupabaseContext,
    @Body(new ZodValidationPipe(createTenantSchema)) body: unknown,
  ) {
    return this.tenants.create(
      readCallerId(ctx.userClaims),
      body as Parameters<TenantsService['create']>[1],
    )
  }

  @Patch(':tenantId')
  @ApiOperation({ summary: 'Editar los datos de la empresa' })
  update(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: unknown,
  ) {
    return this.tenants.update(
      ctx.supabase,
      tenantId,
      body as Parameters<TenantsService['update']>[2],
    )
  }

  /**
   * Suspending is the platform's call, not the company's.
   *
   * It is a route of its own, and not a field on PATCH /tenants/:tenantId,
   * because that one is the company's to call: a member could lift their own
   * suspension the moment the field existed there.
   */
  @Patch(':tenantId/status')
  @RequireAdmin()
  @ApiOperation({ summary: 'Activar o suspender una empresa' })
  setStatus(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(updateTenantStatusSchema)) body: unknown,
  ) {
    return this.tenants.setStatus(tenantId, (body as { status: 'active' | 'suspended' }).status)
  }

  @Get(':tenantId/members')
  @RequireAdmin()
  @ApiOperation({ summary: 'Ver quién pertenece a una empresa' })
  listMembers(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenants.listMembers(tenantId)
  }

  @Get(':tenantId/setup')
  @ApiOperation({ summary: 'Qué le falta a la empresa para que su bot responda' })
  setup(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: Request,
  ) {
    return this.tenants.setup(readCallerId(ctx.userClaims), tenantId, this.publicUrl(request))
  }

  @Get(':tenantId/credentials')
  @ApiOperation({ summary: 'Ver qué credenciales están cargadas (nunca su valor)' })
  listCredentials(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenants.listCredentials(ctx.supabase, tenantId)
  }

  @Put(':tenantId/credentials')
  @ApiOperation({ summary: 'Cargar o rotar una credencial' })
  saveCredential(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(saveCredentialSchema)) body: unknown,
  ) {
    return this.tenants.saveCredential(
      readCallerId(ctx.userClaims),
      tenantId,
      body as Parameters<TenantsService['saveCredential']>[2],
    )
  }

  @Get(':tenantId/whatsapp-numbers')
  @ApiOperation({ summary: 'Números de WhatsApp y la URL de webhook de cada uno' })
  listNumbers(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() request: Request,
  ) {
    return this.tenants.listNumbers(ctx.supabase, tenantId, this.publicUrl(request))
  }

  @Post(':tenantId/whatsapp-numbers')
  @ApiOperation({ summary: 'Registrar un número y generar sus tokens' })
  registerNumber(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(registerWhatsappNumberSchema)) body: unknown,
    @Req() request: Request,
  ) {
    return this.tenants.registerNumber(
      readCallerId(ctx.userClaims),
      tenantId,
      body as Parameters<TenantsService['registerNumber']>[2],
      this.publicUrl(request),
    )
  }

  /**
   * The base of the webhook URL the panel shows. It comes from the request so a
   * tunnel needs no configuration; `PUBLIC_URL` overrides it where the API never
   * sees the host that fronts it.
   */
  private publicUrl(request: Request): string {
    return publicUrlOf(request, this.config.get<string>('PUBLIC_URL'))
  }

  @Get(':tenantId/wisphub/payment-methods')
  @ApiOperation({ summary: 'Las formas de pago que la empresa tiene en Wisphub' })
  listWisphubPaymentMethods(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenants.listWisphubPaymentMethods(readCallerId(ctx.userClaims), tenantId)
  }

  @Get(':tenantId/payment-methods')
  @ApiOperation({ summary: 'Cuentas donde los clientes pagan' })
  listPaymentMethods(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
  ) {
    return this.tenants.listPaymentMethods(ctx.supabase, tenantId)
  }

  @Post(':tenantId/payment-methods')
  @ApiOperation({ summary: 'Agregar una cuenta de recaudo' })
  addPaymentMethod(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(paymentMethodSchema)) body: unknown,
  ) {
    return this.tenants.addPaymentMethod(
      ctx.supabase,
      tenantId,
      body as Parameters<TenantsService['addPaymentMethod']>[2],
    )
  }

  @Delete(':tenantId/whatsapp-numbers/:numberId')
  @ApiOperation({ summary: 'Dar de baja un número: deja de recibir, y su historia queda' })
  retireNumber(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('numberId', ParseUUIDPipe) numberId: string,
  ) {
    return this.tenants.retireNumber(readCallerId(ctx.userClaims), tenantId, numberId)
  }

  @Delete(':tenantId/payment-methods/:methodId')
  @ApiOperation({ summary: 'Quitar una cuenta de recaudo' })
  removePaymentMethod(
    @SupabaseCtx() ctx: SupabaseContext,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('methodId', ParseUUIDPipe) methodId: string,
  ) {
    return this.tenants.removePaymentMethod(ctx.supabase, tenantId, methodId)
  }
}
