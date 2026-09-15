import { Injectable, Logger } from '@nestjs/common'
import type { NotifyAdminJob as NotifyAdminPayload } from '@cobra/contracts'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'

/**
 * Alerts to the administrator, out of the turn's path.
 *
 * Nothing that happens here may fail a turn, so a failure is logged and the job
 * ends successfully: retrying an alert whose 24-hour window has closed would
 * retry forever.
 */
@Injectable()
export class NotifyAdminJobHandler {
  private readonly logger = new Logger(NotifyAdminJobHandler.name)

  constructor(private readonly tenants: TenantRuntimeService) {}

  async handle(job: NotifyAdminPayload): Promise<{ sent: boolean }> {
    try {
      const runtime = await this.tenants.load(job.tenantId)

      if (job.mediaId) {
        await runtime.meta.sendImage(runtime.raw.adminPhone, job.mediaId, job.text)
      } else {
        await runtime.meta.sendText(runtime.raw.adminPhone, job.text)
      }

      return { sent: true }
    } catch (error) {
      this.logger.warn(
        `Alert to the administrator of ${job.tenantId} could not be delivered: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return { sent: false }
    }
  }
}
