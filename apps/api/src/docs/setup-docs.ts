import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { apiReference } from '@scalar/nestjs-api-reference'
import type { Request, Response } from 'express'
import { cleanupOpenApiDoc } from 'nestjs-zod'
import { getAppVersion } from '~/config/app-version'

export const DOCS_PATH = '/docs'
export const OPENAPI_JSON_PATH = '/openapi.json'

/**
 * Serves the OpenAPI document and renders it with Scalar. @nestjs/swagger still
 * builds the document from the controllers; Scalar only replaces the viewer.
 */
export const setupDocs = (app: INestApplication): void => {
  const config = new DocumentBuilder()
    .setTitle('Cobra API')
    .setDescription('Agente de cobros por WhatsApp para ISP que facturan en Wisphub')
    // The deployed build, not a hand-maintained number.
    .setVersion(getAppVersion())
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Access token de Supabase Auth',
    })
    .build()

  // Required by nestjs-zod v5: without it the request bodies come out empty.
  const document = cleanupOpenApiDoc(SwaggerModule.createDocument(app, config))

  app.use(OPENAPI_JSON_PATH, (_req: Request, res: Response) => {
    res.json(document)
  })

  app.use(DOCS_PATH, apiReference({ url: OPENAPI_JSON_PATH, title: 'Cobra API', persistAuth: true }))
}
