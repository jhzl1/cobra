import { ForbiddenException, NotFoundException } from '@nestjs/common'
import type { Response } from 'express'
import { WhatsappController } from './whatsapp.controller'
import type { WhatsappService } from './whatsapp.service'

// The real decorator loads Supabase's auth adapter, which pulls an ESM-only
// dependency Jest cannot require. Calling the controller directly skips the
// guard anyway.
jest.mock('../auth/public-route.decorator', () => ({ PublicRoute: () => () => undefined }))

const SLUG = 'acme'
const TOKEN = 'route-token'

const controllerWith = (resolveRoute: jest.Mock) => {
  const whatsapp = { resolveRoute } as unknown as WhatsappService

  return new WhatsappController(whatsapp)
}

const fakeResponse = () => {
  const send = jest.fn()
  const response = { type: jest.fn().mockReturnValue({ send }) } as unknown as Response

  return { response, send }
}

const subscription = (verifyToken: string) => ({
  'hub.mode': 'subscribe',
  'hub.verify_token': verifyToken,
  'hub.challenge': '1158201444',
})

describe('WhatsappController.verify', () => {
  it('answers the bare challenge when the verify token is the route token', async () => {
    const controller = controllerWith(jest.fn().mockResolvedValue({}))
    const { response, send } = fakeResponse()

    await controller.verify(SLUG, TOKEN, subscription(TOKEN), response)

    expect(response.type).toHaveBeenCalledWith('text/plain')
    expect(send).toHaveBeenCalledWith('1158201444')
  })

  it('refuses a verify token that is not the route token', async () => {
    const controller = controllerWith(jest.fn().mockResolvedValue({}))
    const { response, send } = fakeResponse()

    await expect(
      controller.verify(SLUG, TOKEN, subscription('something-else'), response),
    ).rejects.toBeInstanceOf(ForbiddenException)
    expect(send).not.toHaveBeenCalled()
  })

  it('answers an unknown route the same way the POST does', async () => {
    const controller = controllerWith(jest.fn().mockRejectedValue(new NotFoundException()))
    const { response, send } = fakeResponse()

    await expect(
      controller.verify(SLUG, TOKEN, subscription(TOKEN), response),
    ).rejects.toBeInstanceOf(NotFoundException)
    expect(send).not.toHaveBeenCalled()
  })
})
