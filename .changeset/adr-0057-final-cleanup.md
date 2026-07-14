---
"@object-ui/app-shell": patch
---

refactor(console-ai)!: ADR-0057 final cleanup — remove the chatDock flag, the floating-overlay console chat, and the legacy left Studio copilot

The docked chat is now the console's ONE chat presentation, unconditionally:

- `features.chatDock` is removed from the runtime config (it had already
  flipped to default-on; the kill-switch is retired with the code path it
  guarded).
- `ConsoleFloatingChatbot` (the FAB-armed floating overlay) and its
  `agentPicker` helper are deleted; `ConsoleChatbotFab` is now a small
  dependency-free launcher (`{ appLabel, onOpenDock }`) that opens the dock —
  including on `/home`, where it opens the full-page `/ai` surface (the dock
  maximized) since Home has no shell to host a rail.
- The legacy left `StudioAiCopilot` panel is deleted; the Studio copilot's one
  home is the right `StudioChatDock`. The ADR-0080 `aiSlot` injection seam is
  untouched.
- The runtime SDUI `type: 'chatbot'` bubble (end-user apps) is unchanged
  (ADR-0057 §4).
- Fix: the mobile chat sheet no longer shows a "maximize" button. At 85svh the
  sheet is already the maximal mobile chat, and navigating to full-page `/ai`
  from an OPEN Radix sheet tore it down mid-close (the route change unmounts
  the console synchronously, so the scroll-lock/overlay never released and the
  destination landed blank-and-frozen — "tap maximize → the chat's just gone").
  Full-page `/ai` stays reachable via normal navigation.
