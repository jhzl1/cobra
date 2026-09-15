import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BossService } from './boss/boss.service.js'
import { loadEnv } from './config/env.js'
import { NotifyAdminJobHandler } from './jobs/notify-admin.job.js'
import { ProcessReceiptJobHandler } from './jobs/process-receipt.job.js'
import { ProcessTurnJobHandler } from './jobs/process-turn.job.js'
import { SendMessageJobHandler } from './jobs/send-message.job.js'
import { ConversationRepository } from './repositories/conversation.repository.js'
import { PaymentMethodRepository } from './repositories/payment-method.repository.js'
import { ReceiptRepository } from './repositories/receipt.repository.js'
import { TraceRepository } from './repositories/trace.repository.js'
import { MessagingService } from './runtime/messaging.service.js'
import { SupabaseService } from './runtime/supabase.service.js'
import { TenantRuntimeService } from './runtime/tenant-runtime.service.js'

// ESM has no __dirname; the .env still has to be found next to the app and not
// next to whatever directory the process was started from.
const here = dirname(fileURLToPath(import.meta.url))

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(here, '..', '.env'),
      validate: loadEnv,
    }),
  ],
  providers: [
    SupabaseService,
    TenantRuntimeService,
    MessagingService,
    ConversationRepository,
    ReceiptRepository,
    PaymentMethodRepository,
    TraceRepository,
    ProcessTurnJobHandler,
    ProcessReceiptJobHandler,
    SendMessageJobHandler,
    NotifyAdminJobHandler,
    BossService,
  ],
})
export class AppModule {}
