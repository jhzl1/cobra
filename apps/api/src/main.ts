import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseEnvelopeInterceptor } from './common/interceptors/response.interceptor'
import { DOCS_PATH, setupDocs } from './docs/setup-docs'

const SCALAR_CDN = 'https://cdn.jsdelivr.net'
const SCALAR_FONTS = 'https://fonts.scalar.com'

const bootstrap = async (): Promise<void> => {
  /**
   * `rawBody: true` is what makes the webhook verifiable: Meta signs the exact
   * bytes it sent, and re-serialising the parsed object produces different ones
   * for any message with an accent.
   */
  const app = await NestFactory.create(AppModule, { rawBody: true })
  const config = app.get(ConfigService)

  app.use(buildHelmet())
  app.setGlobalPrefix('api', {
    // Meta's URL is configured in their dashboard and is not part of our API
    // surface, so it does not carry the prefix.
    exclude: [{ path: 'wh/wa/:tenantSlug/:webhookToken', method: -1 as never }],
  })

  app.enableCors({ origin: config.getOrThrow<string[]>('CORS_ORIGINS') })

  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor())
  app.useGlobalFilters(new HttpExceptionFilter())

  setupDocs(app)

  const port = config.getOrThrow<number>('PORT')
  await app.listen(port)

  Logger.log(`Cobra API listening on http://localhost:${port}/api`, 'Bootstrap')
}

/**
 * Strict CSP everywhere except the docs page: Scalar loads its bundle from
 * jsdelivr and needs inline scripts, and a global policy permissive enough for
 * it would weaken every endpoint.
 */
const buildHelmet = () => {
  const strict = helmet()
  const forDocs = helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", "'unsafe-inline'", SCALAR_CDN],
        'style-src': ["'self'", "'unsafe-inline'", SCALAR_CDN],
        'font-src': ["'self'", 'data:', SCALAR_CDN, SCALAR_FONTS],
        'img-src': ["'self'", 'data:', SCALAR_CDN],
        'connect-src': ["'self'", SCALAR_CDN],
        'worker-src': ["'self'", 'blob:'],
      },
    },
  })

  return (req: Parameters<ReturnType<typeof helmet>>[0], res: Parameters<ReturnType<typeof helmet>>[1], next: Parameters<ReturnType<typeof helmet>>[2]) =>
    req.url?.startsWith(DOCS_PATH) ? forDocs(req, res, next) : strict(req, res, next)
}

void bootstrap()
