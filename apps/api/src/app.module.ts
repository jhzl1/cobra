import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { join } from 'node:path'
// Provided here, not only in PlatformModule: TenantsController's gate needs it too.
import { PlatformAdminGuard } from './auth/platform-admin.guard'
import { loadEnv } from './config/env'
import { CryptoModule } from './crypto/crypto.module'
import { ConversationsModule } from './domains/conversations/conversations.module'
import { HealthController } from './domains/health/health.controller'
import { PlatformModule } from './domains/platform/platform.module'
import { TenantsModule } from './domains/tenants/tenants.module'
import { QueueModule } from './queue/queue.module'
import { SupabaseModule } from './supabase/supabase.module'
import { WhatsappModule } from './webhooks/whatsapp.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Anchored to this file, not to the working directory: the default lookup
      // is cwd-relative, so `node dist/main.js` from the repo root would skip
      // the app's own .env and fail validation.
      envFilePath: join(__dirname, '..', '.env'),
      validate: loadEnv,
    }),
    SupabaseModule,
    CryptoModule,
    QueueModule,
    PlatformModule,
    TenantsModule,
    ConversationsModule,
    WhatsappModule,
  ],
  controllers: [HealthController],
  providers: [PlatformAdminGuard],
})
export class AppModule {}
