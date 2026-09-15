import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import { type Observable, map } from 'rxjs'
import type { ApiResponse } from '@cobra/contracts'

/** Wraps every successful body in `{ success, data }` so the web client unwraps once. */
@Injectable()
export class ResponseEnvelopeInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    return next.handle().pipe(map((data) => ({ success: true as const, data })))
  }
}
