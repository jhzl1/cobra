import { Module } from '@nestjs/common'
import { AccountsModule } from '~/domains/accounts/accounts.module'
import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

@Module({
  imports: [AccountsModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
