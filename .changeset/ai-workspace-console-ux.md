---
"@object-ui/app-shell": minor
---

feat(console/ai): AI workspace UX — date-grouped conversations, draggable split, keyboard shortcuts

ChatGPT/Claude-parity polish for the console AI workspace:

- **Date-grouped conversations** — the flat conversations list groups into
  recency sections (Today / Yesterday / Previous 7 days / Previous 30 days /
  Older) with calendar-day boundaries, via a pure exported
  `groupConversationsByDate()`.
- **Draggable chat ↔ preview split** — a draggable, double-click-to-reset divider
  between chat and the Live Canvas preview; width persists to `localStorage`,
  clamped so neither pane collapses (chat ≥ 360px, preview ≥ 420px), keyboard-
  accessible (`role="separator"`, ←/→ resize).
- **Collapsible conversations list** — auto-tucks when the preview opens, with a
  manual toggle.
- **Keyboard shortcuts** — ⌘⇧O new chat, ⌘⇧S toggle the conversations list.
