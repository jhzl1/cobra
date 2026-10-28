import { Module } from '@nestjs/common'
import { PlatformAdminGuard } from '~/auth/platform-admin.guard'
import { PlatformSettingsService } from './platform-settings.service'
import { PlatformController } from './platform.controller'
import { PlatformService } from './platform.service'

@Module({
  controllers: [PlatformController],
  providers: [PlatformService, PlatformSettingsService, PlatformAdminGuard],
  exports: [PlatformService],
})
export class PlatformModule {}
