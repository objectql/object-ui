---
"@object-ui/app-shell": patch
---

feat(console-ai): the FAB becomes the ChatDock launcher when the dock is on (ADR-0057 P3b)

When `features.chatDock` is enabled, the console FAB opens the docked rail instead
of the floating overlay — one entry point, the ADR's "FAB → launcher" step. In
dock mode the FAB stays the lightweight button (it never mounts the heavy floating
chatbot; the rail loads the chat on demand), and a designer "Ask AI" open signal
(assistantBus) opens the dock too. With the flag OFF the FAB is unchanged (floating
overlay). Supersedes P3a's edge launcher (the dock is gated on the same
`showChatbot`, so the FAB is always present to launch it).
