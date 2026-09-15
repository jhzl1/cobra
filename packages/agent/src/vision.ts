import { generateObject } from 'ai'
import type { LanguageModel } from 'ai'
import {
  type ReceiptExtraction,
  receiptExtractionWireSchema,
  toReceiptExtraction,
} from '@cobra/contracts'
import { RECEIPT_EXTRACTOR_PROMPT } from './prompts/vision-prompt'

export interface ReadReceiptInput {
  model: LanguageModel
  /** The downloaded image. Bytes, not a URL: Meta's media URLs need the token. */
  image: Uint8Array | ArrayBuffer
  mediaType?: string
  /** Hard ceiling. A hung vision call holds the turn behind it. */
  timeoutMs?: number
}

/**
 * Reads one receipt.
 *
 * `temperature: 0` because this is transcription, not writing: the same image
 * has to yield the same reference twice, or the deduplication that keeps a
 * customer from being charged twice stops working.
 */
export const readReceipt = async ({
  model,
  image,
  mediaType = 'image/jpeg',
  timeoutMs = 45_000,
}: ReadReceiptInput): Promise<ReceiptExtraction> => {
  const { object } = await generateObject({
    model,
    schema: receiptExtractionWireSchema,
    temperature: 0,
    // `generateObject` takes no `timeout`, unlike `generateText`. The signal is
    // the ceiling, and without one a hung call holds the whole turn behind it.
    abortSignal: AbortSignal.timeout(timeoutMs),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RECEIPT_EXTRACTOR_PROMPT },
          { type: 'file', data: image, mediaType },
        ],
      },
    ],
  })

  return toReceiptExtraction(object)
}
