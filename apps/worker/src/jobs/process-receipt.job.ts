import { Injectable, Logger } from '@nestjs/common'
import { readReceipt, validateReceipt } from '@cobra/agent'
import type { ProcessReceiptJob as ProcessReceiptPayload } from '@cobra/contracts'
import { ConversationRepository } from '../repositories/conversation.repository.js'
import { PaymentMethodRepository } from '../repositories/payment-method.repository.js'
import { ReceiptRepository } from '../repositories/receipt.repository.js'
import { SupabaseService } from '../runtime/supabase.service.js'
import { TenantRuntimeService } from '../runtime/tenant-runtime.service.js'

const BUCKET = 'receipts'

/**
 * Download, read, validate, store — the four steps that used to sit inside the
 * turn.
 *
 * They are their own job so they start the moment the image lands: reading a
 * receipt with Gemini takes several seconds, and those seconds now run while the
 * text burst window is still open instead of after it.
 */
@Injectable()
export class ProcessReceiptJobHandler {
  private readonly logger = new Logger(ProcessReceiptJobHandler.name)

  constructor(
    private readonly tenants: TenantRuntimeService,
    private readonly receipts: ReceiptRepository,
    private readonly paymentMethods: PaymentMethodRepository,
    private readonly conversations: ConversationRepository,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(job: ProcessReceiptPayload): Promise<{ receiptId: string | null }> {
    const { tenantId, conversationId, messageId, mediaId } = job

    // The turn polls for this row. A second delivery of the same message must
    // not produce a second receipt, or the deduplication is comparing a receipt
    // against itself.
    if (await this.receipts.existsForMessage(tenantId, messageId)) return { receiptId: null }

    const runtime = await this.tenants.load(tenantId)
    const { bytes, mediaType } = await runtime.meta.downloadMedia(mediaId)

    const storagePath = `${tenantId}/${conversationId}/${messageId}.${extensionFor(mediaType)}`

    const upload = await this.supabase.admin.storage
      .from(BUCKET)
      .upload(storagePath, bytes, { contentType: mediaType, upsert: true })

    if (upload.error) {
      // The image is worth keeping but not worth stopping for: the reading below
      // works on the bytes in memory either way.
      this.logger.warn(`Could not store ${storagePath}: ${upload.error.message}`)
    } else {
      // Only once it is actually there. The panel signs this path to draw the
      // bubble, and pointing at an object that failed to upload shows a broken
      // image instead of the text that at least says one arrived.
      await this.conversations.attachMedia(tenantId, messageId, storagePath)
    }

    const extraction = await readReceipt({ model: runtime.models.vision, image: bytes, mediaType })

    /**
     * Every account of the tenant, not the customer's zone: at this point
     * nobody has identified the customer yet — the image arrived before any
     * document did.
     */
    const methods = await this.paymentMethods.listAll(tenantId)

    const validated = validateReceipt({
      extraction,
      paymentMethods: methods,
      isReferenceUsed: await this.receipts.anyReferenceUsed(tenantId, extraction.reference),
    })

    const receiptId = await this.receipts.save(tenantId, {
      conversationId,
      messageId,
      mediaId,
      storagePath,
      validated,
    })

    return { receiptId }
  }
}

const extensionFor = (mediaType: string): string => {
  if (mediaType.includes('png')) return 'png'
  if (mediaType.includes('webp')) return 'webp'

  return 'jpg'
}
