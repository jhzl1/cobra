import { z } from 'zod'
// Side effect: zod answers in Spanish. Imported per module, not only from
// index, so importing this file directly cannot skip it.
import './locale'

/**
 * The enums, written once. Each one mirrors a Postgres enum created in
 * @cobra/db; the database is the one that enforces them, this is what the API
 * and the panel agree on.
 */

export const conversationStatusSchema = z.enum(['bot', 'human', 'closed'])
export type ConversationStatus = z.infer<typeof conversationStatusSchema>

export const messageDirectionSchema = z.enum(['inbound', 'outbound'])
export type MessageDirection = z.infer<typeof messageDirectionSchema>

export const messageAuthorSchema = z.enum(['contact', 'agent', 'operator'])
export type MessageAuthor = z.infer<typeof messageAuthorSchema>

export const messageTypeSchema = z.enum(['text', 'image'])
export type MessageType = z.infer<typeof messageTypeSchema>

export const deliveryStateSchema = z.enum(['pending', 'sent', 'failed'])
export type DeliveryState = z.infer<typeof deliveryStateSchema>

export const credentialProviderSchema = z.enum(['meta', 'openrouter', 'wisphub'])
export type CredentialProvider = z.infer<typeof credentialProviderSchema>

export const agentRunTriggerSchema = z.enum(['inbound', 'manual_replay'])
export type AgentRunTrigger = z.infer<typeof agentRunTriggerSchema>

export const agentRunStatusSchema = z.enum(['running', 'done', 'error', 'skipped'])
export type AgentRunStatus = z.infer<typeof agentRunStatusSchema>

export const agentStepKindSchema = z.enum([
  'normalize',
  'media',
  'vision',
  'validation',
  'tool',
  'llm',
  'send',
])
export type AgentStepKind = z.infer<typeof agentStepKindSchema>

export const agentStepStatusSchema = z.enum(['running', 'done', 'error', 'skipped'])
export type AgentStepStatus = z.infer<typeof agentStepStatusSchema>

export const paymentAttemptKindSchema = z.enum(['invoice_payment', 'credit'])
export type PaymentAttemptKind = z.infer<typeof paymentAttemptKindSchema>

export const paymentAttemptStateSchema = z.enum(['pending', 'confirmed', 'failed', 'unknown'])
export type PaymentAttemptState = z.infer<typeof paymentAttemptStateSchema>

/**
 * Meta's free-form service window: 24 hours from the contact's last message.
 * Outside it, anything that is not an approved template is rejected with error
 * 131047. The panel counts this down and locks its composer when it runs out.
 */
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000
