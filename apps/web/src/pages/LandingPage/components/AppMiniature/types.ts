export type DemoStep = 'lookup' | 'check' | 'register'

export type StepStatus = 'pending' | 'running' | 'done'

export type TurnStatus = 'idle' | 'running' | 'done'

/** The conversation the demo plays, as its row in the list shows it. */
export interface FeaturedRow {
  isOnTop: boolean
  isUnread: boolean
  preview: string
  time: string
  /** The list labels only a closed conversation or one with an advisor. */
  label: 'Cerrada' | 'Asesor' | null
}

export interface MiniatureState {
  featuredRow: FeaturedRow
  unreadCount: number
  messagesShown: number
  /** What the agent is doing right now, in the panel's own sentence. */
  narrative: string | null
  isAgentWorking: boolean
  steps: Record<DemoStep, StepStatus>
  turn: TurnStatus
}

/** One moment of the demo: how long it waits, then what it changes. */
export interface ScriptBeat {
  waitMs: number
  apply: (state: MiniatureState) => MiniatureState
}
