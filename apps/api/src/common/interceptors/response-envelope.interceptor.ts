import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { type Observable, map } from 'rxjs'
import type { ApiResponse } from '@cobra/contracts'
import { RAW_RESPONSE } from '~/common/decorators/raw-response.decorator'

/**
 * Wraps every successful body in `{ success, data }` so the web client unwraps
 * once — except where `@RawResponse()` says not to.
 *
 * That exception is not decorative. Meta's handshake compares the body against
 * the challenge it sent, and an envelope around it fails the verification with
 * a message that names neither the envelope nor the route.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiResponse<T> | T> {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T> | T> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass(),
    ])

    if (raw) return next.handle()

    return next.handle().pipe(map((data) => ({ success: true as const, data })))
  }
}
