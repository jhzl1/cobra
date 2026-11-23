import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { getAppVersion } from '~/config/app-version'

@ApiTags('Health')
@Controller('health')
export class HealthController {
  /**
   * Resolved once at construction: the version cannot change while the process
   * lives, and the fallback reads package.json off the disk.
   */
  private readonly version = getAppVersion()

  @Get()
  @ApiOperation({ summary: 'Estado y versión del servicio' })
  check(): { status: 'ok'; version: string } {
    return { status: 'ok', version: this.version }
  }
}
