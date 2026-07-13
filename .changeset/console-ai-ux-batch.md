---
"@object-ui/app-shell": minor
"@object-ui/plugin-chatbot": minor
---

feat(console-ai): package binding chip + inert handoff cards + honest send hint (#2458 / ADR-0057 A1.a)

Three UX improvements from live magic-flow testing:

- **A1.a — package binding chip** (`app-shell`): the build surface header shows
  the package the conversation is bound to (`📦 <app>`), or **"New app"** when
  unbound — so the edit blast-radius is always visible (Claude-Code-shows-the-repo
  idiom). The magic flow starts unbound and binds the moment its build mints a
  package (`deriveBoundPackageId` reads `?package=` else the latest draft/handoff
  result; unit-tested).
- **UX#5 — only the latest handoff card is actionable** (`plugin-chatbot`): when
  a thread accumulates several "Open in Builder →" cards, only the newest stays
  clickable; older (superseded) cards' buttons are disabled — derived from
  message order, so it survives the navigation the button triggers and the pane
  remount that follows. A stale prompt in an older card can't be re-fired.
- **UX#7 — honest send hint** (`plugin-chatbot`): the composer already sends on
  plain Enter (Shift+Enter = newline); dropped the misleading `⌘` glyph from the
  hint so it no longer implies Cmd+Enter.
