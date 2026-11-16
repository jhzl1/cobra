import { Module } from '@nestjs/common'
import { HeldReceiptsController } from './held-receipts.controller'
import { HeldReceiptsService } from './held-receipts.service'

@Module({
  controllers: [HeldReceiptsController],
  providers: [HeldReceiptsService],
})
export class HeldReceiptsModule {}
