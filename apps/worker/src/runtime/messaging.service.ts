import { Injectable, Logger } from '@nestjs/common'
import type { MessagingPort } from '@cobra/agent'
import type { TenantRuntime } from './tenant-runtime.service.js'

/**
 * Alerts to the administrator, as a port the agent can call.
 *
 * Best-effort by contract. In n8n, execution 38986 died red because the alert
 * node referenced a node that had not run: the customer already had their
 * confirmation and the execution was still marked failed. Nothing about
 * notifying the administrator may take a turn down, so every failure is logged
 * and swallowed here as well as at the call site.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name)

  forTenant(runtime: TenantRuntime): MessagingPort {
    return {
      notifyAdmin: async (message: string, mediaId?: string | null) => {
        try {
          if (mediaId) {
            await runtime.meta.sendImage(runtime.raw.adminPhone, mediaId, message)
            return
          }

          await runtime.meta.sendText(runtime.raw.adminPhone, message)
        } catch (error) {
          /**
           * Outside the 24-hour window Meta answers 131047 and the alert never
           * arrives. The n8n node had `onError: continueRegularOutput`, so that
           * failure was swallowed and the execution stayed green — which is how
           * nobody noticed. Here it is at least written down.
           */
          this.logger.warn(
            `Could not notify the administrator of tenant ${runtime.raw.id}: ${describe(error)}`,
          )
        }
      },
    }
  }
}

const describe = (error: unknown): string => (error instanceof Error ? error.message : String(error))
