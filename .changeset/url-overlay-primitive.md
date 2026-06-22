---
"@object-ui/app-shell": patch
---

feat(app-shell): useUrlOverlay primitive + URL-addressable keyboard-shortcuts dialog (ADR-0054 Phase 2)

Adds `useUrlOverlay(key)` — a reusable, router-aware hook that stores a navigable
overlay's open state in a `?<key>=1` URL param (idempotent open, deep-linkable,
restore-on-reload, back/forward; `alias`/`value`/`replace` configurable). The
command palette is refactored onto it (behavior unchanged: `?palette=1`, `?cmdk=1`
alias). The keyboard-shortcuts dialog becomes URL-addressable (`?shortcuts=1`) and
gains a click entry in the header Help menu — previously it was only reachable via
the `?` key (which remains an accelerator). Generalizes ADR-0054 invariants C1/C3
beyond the Phase 1 reference fix; the shared overlay primitives already carry
`data-testid` + Radix `data-state`, documented in the README.
