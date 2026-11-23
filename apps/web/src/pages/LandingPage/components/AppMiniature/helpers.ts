import type { DemoStep, MiniatureState, ScriptBeat, StepStatus } from './types'

/** The demo before the customer writes: their conversation closed, at the bottom. */
export const INITIAL_STATE: MiniatureState = {
  featuredRow: {
    isOnTop: false,
    isUnread: false,
    preview: 'Muchas gracias',
    time: '09:12',
    label: 'Cerrada',
  },
  unreadCount: 1,
  messagesShown: 0,
  narrative: null,
  isAgentWorking: false,
  steps: { lookup: 'pending', check: 'pending', register: 'pending' },
  turn: 'idle',
}

/**
 * A customer pays November's bill and the agent registers it, about fourteen
 * seconds end to end, then the scene holds and starts over. The sentences are
 * the ones the panel's timeline shows for each step.
 */
export const DEMO_SCRIPT: ScriptBeat[] = [
  {
    waitMs: 600,
    apply: (state) => ({
      ...state,
      featuredRow: {
        isOnTop: true,
        isUnread: true,
        preview: 'Buenos días, ya realicé el pago de noviembre',
        time: '10:41',
        label: null,
      },
      unreadCount: 2,
      messagesShown: 1,
      isAgentWorking: true,
      turn: 'running',
    }),
  },
  {
    waitMs: 500,
    apply: (state) => ({
      ...withStep(state, 'lookup', 'running'),
      narrative: 'Consultando la cuenta del cliente en Wisphub',
    }),
  },
  {
    waitMs: 1000,
    apply: (state) => ({
      ...withStep(state, 'lookup', 'done'),
      narrative: 'Redactando la respuesta',
    }),
  },
  { waitMs: 700, apply: (state) => ({ ...state, messagesShown: 2, narrative: null }) },
  {
    waitMs: 1800,
    apply: (state) => ({
      ...state,
      messagesShown: 3,
      featuredRow: { ...state.featuredRow, preview: 'Comprobante' },
    }),
  },
  { waitMs: 500, apply: (state) => ({ ...state, narrative: 'Leyendo el comprobante' }) },
  {
    waitMs: 1300,
    apply: (state) => ({
      ...withStep(state, 'check', 'running'),
      narrative: 'Revisando si hay un comprobante pendiente',
    }),
  },
  { waitMs: 1500, apply: (state) => withStep(state, 'check', 'done') },
  {
    waitMs: 300,
    apply: (state) => ({
      ...withStep(state, 'register', 'running'),
      narrative: 'Registrando el pago en Wisphub',
    }),
  },
  {
    waitMs: 1300,
    apply: (state) => ({
      ...withStep(state, 'register', 'done'),
      narrative: 'Redactando la respuesta',
    }),
  },
  {
    waitMs: 700,
    apply: (state) => ({
      ...state,
      messagesShown: 4,
      narrative: null,
      isAgentWorking: false,
      turn: 'done',
      featuredRow: {
        ...state.featuredRow,
        preview: 'Agente: Tu pago de $ 75.000 quedó registrado',
      },
    }),
  },
  // The finished scene stays up long enough to be read before it restarts.
  { waitMs: 4200, apply: (state) => state },
]

/** The last frame, for visitors who asked for less motion: the whole story, still. */
export const settledState = (): MiniatureState => {
  let state = INITIAL_STATE

  for (const beat of DEMO_SCRIPT) state = beat.apply(state)

  return state
}

const withStep = (state: MiniatureState, step: DemoStep, status: StepStatus): MiniatureState => ({
  ...state,
  steps: { ...state.steps, [step]: status },
})
