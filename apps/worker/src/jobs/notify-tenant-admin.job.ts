import { Injectable, Logger } from '@nestjs/common'
import type { NotifyTenantAdminPayload } from '@cobra/contracts'
import { errorMessageOf, headlineOf } from '../runtime/tenant-admin-alert.service.js'
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

      // Checked at send and not at enqueue: the company can leave or enter
      // dry-run while the alert waits in the queue.
      if (runtime.runtimeConfig.dryRun) {
        this.logger.log(
          `Dry-run: alert to the administrator of ${payload.tenantId} not sent — ${headlineOf(payload.text, payload.mediaId)}`,
        )

        return { sent: false }
      }

      if (payload.mediaId) {
        await runtime.whatsapp.sendImage(
          runtime.runtimeConfig.adminPhone,
          payload.mediaId,
          payload.text,
        )
      } else {
        await runtime.whatsapp.sendText(runtime.runtimeConfig.adminPhone, payload.text)
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
