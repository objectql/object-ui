---
"@object-ui/app-shell": minor
"@object-ui/layout": minor
---

feat(console-ai): ChatDock — right-docked AI rail behind a default-off flag (ADR-0057 P3a)

Stands up the ADR-0057 P3 docked rail as an ADDITIVE, DEFAULT-OFF shell: until an
operator sets `features.chatDock`, nothing changes and the FAB stays the
canonical entry.

- `@object-ui/layout`: `AppShell` gains an optional `rightRail` prop, rendered as
  a flex sibling of the main content so the rail REFLOWS the content beside it
  (VS Code / Cursor idiom), not overlaying it. Absent → unchanged single-pane.
- `@object-ui/app-shell`: new `ChatDock` — a collapsible, resizable right rail
  that reuses the shared `ChatPane` engine over the P1 `(user, app, product=ask)`
  conversation (the same ambient thread the FAB/`/ai` shows; it's a VIEW, not a
  new conversation). Default COLLAPSED (a fixed edge launcher → zero layout cost
  until invoked); ⌘/Ctrl+Shift+I toggles it. Gated on `useAiSurfaceEnabled` AND
  the flag, so OSS / no-seat runtimes render nothing.
- `runtime-config`: `chatDock?` rollout flag, parsed default-OFF (opt-in only).

Live-verified with the flag forced on: the launcher expands to a rail rendering
the ask chat, the dashboard content reflows narrower beside it, and collapse
restores the launcher. Unit-tested: width clamp, the composer-safe shortcut
matcher (⌘⇧I, no collision with the ⌘⇧O/S page shortcuts), and the flag's
default-off/opt-in parse. FAB retirement (P3b) and `/ai`-as-maximized-dock +
Studio reflow (P3c) follow.
