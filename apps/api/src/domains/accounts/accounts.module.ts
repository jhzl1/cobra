import { Module } from '@nestjs/common'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'

@Module({
  controllers: [AccountsController],
  providers: [AccountsService],
  // Creating a company creates its first user.
  exports: [AccountsService],
})
export class AccountsModule {}
