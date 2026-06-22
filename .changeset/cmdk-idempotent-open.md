---
"@object-ui/app-shell": patch
"@object-ui/components": patch
---

fix(app-shell): command palette idempotent open + stable locators (ADR-0054 Phase 1)

The top-bar "Search… ⌘K" button now opens the command palette directly via a
shared, idempotent `openCommandPalette()` instead of re-dispatching a synthetic
`⌘K` `KeyboardEvent` — so it works under automation and in ⌘K-reserving
browsers. Open state is URL-addressable (`?palette=1`, `?cmdk=1` alias), making
the palette deep-linkable and restore-on-reload. The dialog and header trigger
emit stable `data-testid` locators (`overlay:command-palette`,
`action:command-palette:open`) plus an ARIA name. New `useCommandPalette()` hook
and `CommandPaletteProvider`; `CommandDialog` gains a `contentProps` passthrough
for the dialog locator/ARIA. Implements invariants C1/C3/C4 of the UI
testability contract.
