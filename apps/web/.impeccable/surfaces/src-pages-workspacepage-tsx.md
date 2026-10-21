---
version: 1
slug: "src-pages-workspacepage-tsx"
primary_target: "src/pages/WorkspacePage.tsx"
related_targets: ["src/components/ConversationList.tsx","src/components/ChatPanel.tsx","src/components/Timeline.tsx","src/components/AppLayout.tsx"]
---

# Chats (WorkspacePage)

Mode: Operate. Primary user: the ISP operator watching live conversations, on desktop all day and on the phone after a handoff alert. Job: see which conversation needs a person, take control, answer inside the 24-hour window, hand back to the agent. Constraints: dark only, Spanish UI, one white action per screen, creation in modals.

## Direction contract

THESIS: The chats screen is a dark graphite console of three persistent panes split by 1px seams, not three floating cards. Navigation changes pane contents, never the layout.

OWN-WORLD: Near-black #0a0a0a ground, #111 pane, #181818 raised, #262626 seams; text #ededed, secondary #9a9a9a. State colour only: green #7ee787 done, blue #79c0ff running (dashed ring), orange #ffa657 human, red #ff7b72 failed. The conversation summary carries no running or paid field, so list rows use orange, red and grey; the dashed ring and green live in the agent log, per step. Unread takes weight, never colour. Red Hat Text for reading, Red Hat Display for names and titles, Red Hat Mono for every number, time, phone and step log. White fill only on the one primary action.

STORY: The operator scans the list for the orange or red dot, opens it, reads the transcript (each bubble names its author, so where the operator took over reads from the authors; the data carries no handoff events to mark inline), sees the window clock, writes, and returns control.

FIRST VIEWPORT: 52px header (Cobra / company, version right; a company can own several WhatsApp numbers, so no single number belongs in the header), 42px underlined tabs with the unread count in bold mono; panes 360px list, fluid chat, 340px agent log. Primary action: with the agent in control it is "Tomar el control", white, top right of the chat pane; with the operator in control the white action is "Enviar", lit once there is a draft, and "Devolver el control" is secondary, because the operator's job there is writing. On phone: list, then chat full screen with a back control.

FORM: Consola oscura with Red Hat voice, user-steered from the first hand (dark-first developer console, digital-design-canon-dark-first-developer-console) plus bolder-hand raises: state change held marked until opened (gate board), one size for tabular data (timetable), hierarchy by sans/mono contrast (specimen), state changes as 100 ms colour swaps, no fades or entrances (acetate). seed:a6b27b847bb1a48e

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
