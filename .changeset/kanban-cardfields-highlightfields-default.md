---
"@object-ui/plugin-kanban": minor
---

feat(kanban): default card fields to the object's `highlightFields` when a view configures none (ADR-0085 follow-up, #2162)

`ObjectKanban` used to render explicit view-level `cardFields` and, when a board
declared none, drop straight to a legacy semantic-field heuristic (guessing at
amount / owner / priority). That guesswork ignored the object's own declared
intent and diverged from every other surface.

Card fields now resolve through a shared `resolveKanbanCardFields` helper in
priority order:

1. **View-level `cardFields`** — the author's explicit choice always wins.
2. **The object's `highlightFields`** — the ADR-0085 semantic role (its curated
   "most important fields"), the same list Grid, List and Detail already default
   to. Entries referencing a field the object no longer declares are dropped.
3. **The legacy semantic-field heuristic** — used only when neither is available.

A board over an object with no per-view card config now shows the same curated
fields as the object's other views, instead of best-effort guesses.
