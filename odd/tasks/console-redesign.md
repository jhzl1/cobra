# Console redesign — chats screen

## Objective

Replace the stock shadcn look of the panel with the "dark console, Red Hat voice"
world the user chose, starting with the chats screen.

## Problem

The panel reads as AI-generated: shadcn's default zinc tokens verbatim, Plus Jakarta
Sans (flagged by the Impeccable detector), three floating cards side by side, pills
and 10px uppercase labels everywhere.

## Scope

- In: tokens and fonts (`index.css`), button/badge/input primitives, the app shell
  (`AppLayout`), the chats screen (`WorkspacePage`, `ConversationList`, `ChatPanel`,
  `Timeline`, `ServiceWindow`), phone layout for chats, `DESIGN.md` rewrite.
- Out: redesigning Settings, Setup, Platform and Login beyond what the new tokens
  give them for free.

## Constraints

Dark only; `<html class="dark">` stays. Spanish UI, English code. One white action
per screen. Direction contract: `apps/web/.impeccable/surfaces/src-pages-workspacepage-tsx.md`.

## Tasks

- [ ] T1 Tokens, Red Hat fonts, primitives (button, badge, input). Route: inline.
- [ ] T2 Shell: full-bleed header, underlined section tabs, page padding moved to routes. Route: inline.
- [ ] T3 Chats screen: three panes split by seams, phone layout (list → chat). Route: inline.
- [ ] T4 Rows, chat, agent log restyled to the contract. Route: inline.
- [ ] T5 Render check desktop + phone, finish review, DESIGN.md. Route: inline + reviewer agent.

## Checks

`pnpm --filter @cobra/web tscheck`, `pnpm --filter @cobra/web build`, rendered
screenshots at 1440 and 390. Tests run once before the PR (global rule).

## Progress

- Branch `feat/console-redesign` from `feat/live-inbox-notifications` (969093b).
- Fonts added: `@fontsource-variable/red-hat-{text,display,mono}`.

## Next step

T1.
