---
"@object-ui/app-shell": patch
---

feat(console-ai): /ai = the ChatDock maximized + Studio right-dock reflow (ADR-0057 P3c)

The final P3 slice, all behind the default-off `features.chatDock` flag:

- **/ai ⇄ rail continuity**: the dock header gains a maximize button that opens
  the full-page `/ai` surface, and the `/ai` page gains a collapse-to-dock button
  that returns to the console with the rail expanded — same thread both ways
  (the P1 `(user, app, product)` conversation key). Deep links
  (`/ai/:agent/:conversationId`, ADR-0013) are untouched and keep working.
- **Studio reflow** (the ADR's decided grid `[left: nav/tree] [center: canvas +
  properties] [right: chat]`): the AI copilot leaves the left `w-96` panel and
  renders as the shared right dock (`ChatDockPanel` + `ChatDockLauncher`), same
  package-scoped build thread; the Interfaces pillar's right inspector folds
  into center `[Canvas | Properties]` tabs with select-a-block auto-switch. An
  injected `aiSlot` (cloud seam, ADR-0080) keeps the legacy left panel.
- **Live Canvas** (ADR-0037): in the rail, the dock auto-maximizes while the
  canvas is open and tucks back on close (manual resize wins); maximized (`/ai`)
  keeps the existing beside-the-chat split.

With the flag OFF, `/ai` and Studio are pixel-identical to before.
