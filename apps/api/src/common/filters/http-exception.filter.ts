import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { AuthError } from '@supabase/server'
import type { Response } from 'express'

/**
 * The only exception filter, mirroring the success envelope so clients never
 * branch on response shape.
 *
 * One filter and not two: a filter that re-throws what it does not handle does
 * NOT pass the exception to the next one — Nest treats the throw as escaping the
 * cycle and Express answers with its default HTML error page.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>()

    if (exception instanceof HttpException) {
      const { cause } = exception

      /**
       * Every reason a token can fail answers the same message: an expired
       * token, a missing header and a signature from another project have to
       * look identical from outside, or the response becomes a way to probe the
       * setup. Which one it was goes to the log.
       */
      if (cause instanceof AuthError) {
        this.logger.warn(`Auth rejected [${cause.code}]: ${cause.message}`)

        response.status(cause.status).json({
          success: false,
          message: 'La sesión no es válida o expiró',
          code: cause.code,
        })
        return
      }

      response.status(exception.getStatus()).json({
        success: false,
        ...normalizeHttpBody(exception.getResponse()),
      })
      return
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : exception,
    )

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Ocurrió un error inesperado. Intente de nuevo en unos minutos.',
    })
  }
}

const normalizeHttpBody = (body: string | object): Record<string, unknown> => {
  if (typeof body === 'string') return { message: body }

  const { statusCode: _statusCode, ...rest } = body as Record<string, unknown>

  return rest
}
