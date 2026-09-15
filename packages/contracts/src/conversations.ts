import { z } from 'zod'
import {
  agentRunStatusSchema,
  agentRunTriggerSchema,
  agentStepKindSchema,
  agentStepStatusSchema,
  conversationStatusSchema,
  deliveryStateSchema,
  messageAuthorSchema,
  messageDirectionSchema,
  messageTypeSchema,
} from './domain'

export const conversationSummarySchema = z.object({
  id: z.uuid(),
  status: conversationStatusSchema,
  assignedTo: z.uuid().nullable(),
  contact: z.object({
    id: z.uuid(),
    personId: z.string(),
    phone: z.string().nullable(),
    displayName: z.string().nullable(),
  }),
  lastMessageAt: z.string().nullable(),
  lastInboundAt: z.string().nullable(),
  lastMessagePreview: z.string().nullable(),
  /** True when the most recent run of this conversation ended in error. */
  lastRunFailed: z.boolean(),
})

export type ConversationSummary = z.infer<typeof conversationSummarySchema>

export const messageSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  direction: messageDirectionSchema,
  author: messageAuthorSchema,
  type: messageTypeSchema,
  body: z.string().nullable(),
  mediaUrl: z.string().nullable(),
  deliveryState: deliveryStateSchema.nullable(),
  deliveryError: z.string().nullable(),
  sentAt: z.string().nullable(),
  receivedAt: z.string(),
})

export type Message = z.infer<typeof messageSchema>

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4096),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

/**
 * Handoff. `human` parks the agent: inbound messages are still stored, the model
 * is not called. `bot` gives it back. `replay` hands the accumulated messages to
 * the agent in one turn, which is the second button in the panel.
 */
export const handoffSchema = z.object({
  action: z.enum(['take', 'release', 'replay']),
})

export type HandoffInput = z.infer<typeof handoffSchema>

export const agentStepSchema = z.object({
  id: z.uuid(),
  runId: z.uuid(),
  seq: z.number().int(),
  kind: agentStepKindSchema,
  name: z.string(),
  status: agentStepStatusSchema,
  toolCallId: z.string().nullable(),
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  createdAt: z.string(),
})

export type AgentStep = z.infer<typeof agentStepSchema>

export const agentRunSchema = z.object({
  id: z.uuid(),
  conversationId: z.uuid(),
  trigger: agentRunTriggerSchema,
  status: agentRunStatusSchema,
  model: z.string().nullable(),
  inputTokens: z.number().int().nullable(),
  outputTokens: z.number().int().nullable(),
  error: z.string().nullable(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  steps: z.array(agentStepSchema),
})

export type AgentRun = z.infer<typeof agentRunSchema>

/** The channel the panel subscribes to for one conversation. */
export const conversationTopic = (conversationId: string): string =>
  `conversation:${conversationId}`
