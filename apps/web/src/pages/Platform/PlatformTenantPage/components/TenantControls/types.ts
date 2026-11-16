export type Change = 'agent-off' | 'agent-on' | 'dry-run-on' | 'dry-run-off'

export interface ChangeCopy {
  title: string
  paragraphs: string[]
  confirmLabel: string
  /** The direction that reaches real customers or real money gets the destructive button. */
  isDangerous: boolean
}
