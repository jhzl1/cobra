import { describe, expect, it, vi } from 'vitest'
import { Steering } from '../turn/steering'
import type { ToolDeps } from './index'
import { notifyAdminTool } from './notify-admin.tool'

const buildDeps = (mediaId: string | null) => {
  const notifyTenantAdmin = vi.fn(async () => undefined)

  const deps: ToolDeps = {
    tenantId: 'tenant-1',
    conversationId: 'conversation-1',
    wisphub: {} as ToolDeps['wisphub'],
    receipts: {} as ToolDeps['receipts'],
    messaging: { notifyTenantAdmin },
    steps: { start: vi.fn(async () => 'step-1'), finish: vi.fn(async () => undefined) },
    steering: new Steering({ readUnconsumed: async () => [] }),
    listPaymentMethods: async () => [],
    pendingReceipt: null,
    mediaId,
  }

  return { deps, notifyTenantAdmin }
}

const callTool = async (deps: ToolDeps, input: unknown) => {
  const tool = notifyAdminTool(deps)
  const options = { toolCallId: 'call-1', messages: [], context: {} }

  return tool.execute?.(input, options)
}

describe('NotifyAdmin', () => {
  it('attaches the image of the turn when the model asks for it', async () => {
    const { deps, notifyTenantAdmin } = buildDeps('media-1')

    await callTool(deps, { message: 'Comprobante retenido', attachImage: true })

    expect(notifyTenantAdmin).toHaveBeenCalledWith('Comprobante retenido', 'media-1')
  })

  it('sends text only when the model does not ask for the image', async () => {
    const { deps, notifyTenantAdmin } = buildDeps('media-1')

    await callTool(deps, { message: 'Pago que no cubre el total', attachImage: false })

    expect(notifyTenantAdmin).toHaveBeenCalledWith('Pago que no cubre el total', null)
  })

  it('degrades to a text alert when the turn has no image to attach', async () => {
    const { deps, notifyTenantAdmin } = buildDeps(null)

    await callTool(deps, { message: 'Caso escalado', attachImage: true })

    expect(notifyTenantAdmin).toHaveBeenCalledWith('Caso escalado', null)
  })

  it('accepts a call that omits the flag, so the alert is never lost to validation', () => {
    const { deps } = buildDeps('media-1')
    const schema = notifyAdminTool(deps).inputSchema as { parse(value: unknown): unknown }

    expect(schema.parse({ message: 'Caso escalado' })).toEqual({
      message: 'Caso escalado',
      attachImage: false,
    })
  })
})
