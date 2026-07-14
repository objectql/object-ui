---
"@object-ui/app-shell": patch
---

feat(console-ai): the ChatDock is now DEFAULT ON (ADR-0057 P3 go-live)

`features.chatDock` flips from opt-in to opt-out: the right-docked chat rail
(FAB as launcher, `/ai` as the panel maximized, Studio right dock with center
`[Canvas | Properties]` tabs) is the console's default chat presentation. The
flag survives only as a server-side kill-switch — an operator sending
`chatDock: false` restores the floating-overlay console until the final
cleanup removes that path (epic #2409).
