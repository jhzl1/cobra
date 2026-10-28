import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { firstValueFrom, of } from 'rxjs'
import { ResponseEnvelopeInterceptor } from './response-envelope.interceptor'

const handlerReturning = <T>(value: T): CallHandler<T> => ({ handle: () => of(value) })

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a normal response', async () => {
    const interceptor = new ResponseEnvelopeInterceptor()

    const result = await firstValueFrom(
      interceptor.intercept({} as ExecutionContext, handlerReturning({ status: 'ok' })),
    )

    expect(result).toEqual({ success: true, data: { status: 'ok' } })
  })
})
