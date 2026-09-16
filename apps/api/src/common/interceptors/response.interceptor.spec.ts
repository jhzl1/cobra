import type { CallHandler, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { firstValueFrom, of } from 'rxjs'
import { ResponseEnvelopeInterceptor } from './response.interceptor'

const contextFor = (raw: boolean) => {
  const reflector = new Reflector()

  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(raw)

  return {
    reflector,
    context: {
      getHandler: () => () => {},
      getClass: () => class {},
    } as unknown as ExecutionContext,
  }
}

const handlerReturning = <T>(value: T): CallHandler<T> => ({ handle: () => of(value) })

describe('ResponseEnvelopeInterceptor', () => {
  it('wraps a normal response', async () => {
    const { reflector, context } = contextFor(false)
    const interceptor = new ResponseEnvelopeInterceptor(reflector)

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReturning({ status: 'ok' })),
    )

    expect(result).toEqual({ success: true, data: { status: 'ok' } })
  })

  /**
   * Meta compares the handshake body against the challenge it sent. An envelope
   * around it fails the verification with a message that names neither the
   * envelope nor the route, which is exactly how long it took to find.
   */
  it('returns the body untouched when the route asked for it raw', async () => {
    const { reflector, context } = contextFor(true)
    const interceptor = new ResponseEnvelopeInterceptor(reflector)

    const result = await firstValueFrom(
      interceptor.intercept(context, handlerReturning('1234567890')),
    )

    expect(result).toBe('1234567890')
  })
})
