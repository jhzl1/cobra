import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'

/**
 * A standalone context, not an HTTP server: this process listens on queues.
 *
 * `enableShutdownHooks` is what makes `boss.stop({ graceful: true })` run on a
 * Railway redeploy, so a turn in flight finishes instead of being killed
 * halfway through a payment.
 */
const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.createApplicationContext(AppModule)

  app.enableShutdownHooks()

  Logger.log('Cobra worker started', 'Bootstrap')
}

void bootstrap()
