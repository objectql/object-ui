---
"@object-ui/app-shell": minor
---

**app-shell: the object page stops emitting `groupBy` in its view-level kanban config.**

`ObjectView`'s `kanbanViewOptions` wrote two spellings of one concept into
`options.kanban` — the spec's `groupByField`, and beside it `groupBy`. Measured
against `@objectstack/spec` 17.3.0, the strict `KanbanConfigSchema` declares
`groupByField` / `summarizeField` / `columns` and refuses `groupBy` **by name**
(control on the same call: a bogus key is refused by name; `groupByField` alone
is refused nothing). Upstream even knows the other legacy spelling by name —
probing `groupField` answers "Did you mean `groupField` → `groupByField`?" — and
knows nothing about `groupBy`. This repo was producing a third dialect for a key
the contract already carries, which is exactly what AGENTS.md #0.1 forbids
fixing at the renderer instead of the producer.

**Breaking, in the sense worth stating explicitly** (shipped `minor`: this repo
never declares `major`). A consumer reading `options.kanban.groupBy` off the
schema this page builds loses that key. What such a consumer loses is nothing:
the identical value is written by the same expression under `groupByField`, the
capability gate resolves `groupByField || groupField` and never read `groupBy`,
the kanban render branch resolves `groupByField || groupField ||
detectStatusField(...)` and never read it either, and the one reader that did
list it — `ListView`'s projection/expand collectors, which offer
`v.groupByField, v.groupField, v.groupBy` as candidates for the same lane value
— reads the canonical key first. A producer census over every tracked file found
no other runtime writer of a view-level `groupBy` in this repo, and the sibling
producer `defaultKanbanFromObject` has emitted `{ groupByField }` alone all
along. Anyone who *did* author the key was already off-spec: the platform
refuses it at authoring and publish time.

Removing the write also takes away the only producer feeding a latent override:
`ListView`'s kanban branch spreads the rest of the merged config **after** its
own `groupBy: laneField`, so a surviving `groupBy` won over the lane the branch
had just resolved. Both held the same value, so nothing was visibly wrong yet.
The override itself is untouched here and is tracked separately.
