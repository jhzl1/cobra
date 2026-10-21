import { Injectable, Logger } from '@nestjs/common'
import type { NotifyTenantAdminPayload } from '@cobra/contracts'
import { errorMessageOf } from '../runtime/tenant-admin-alert.service.js'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'

/**
 * Alerts to the administrator, out of the turn's path.
 *
 * Nothing that happens here may fail a turn, so a failure is logged and the job
 * ends successfully: retrying an alert whose 24-hour window has closed would
 * retry forever.
 */
@Injectable()
export class NotifyTenantAdminJobHandler {
  private readonly logger = new Logger(NotifyTenantAdminJobHandler.name)

  constructor(private readonly tenantRuntimes: TenantRuntimeService) {}

  async run(payload: NotifyTenantAdminPayload): Promise<{ sent: boolean }> {
    try {
      const runtime = await this.tenantRuntimes.load(payload.tenantId)

      if (payload.mediaId) {
        await runtime.meta.sendImage(
          runtime.runtimeConfig.adminPhone,
          payload.mediaId,
          payload.text,
        )
      } else {
        await runtime.meta.sendText(runtime.runtimeConfig.adminPhone, payload.text)
      }

      return { sent: true }
    } catch (error) {
      this.logger.warn(
        `Alert to the administrator of ${payload.tenantId} could not be delivered: ${errorMessageOf(error)}`,
      )

      return { sent: false }
    }
  }
}
