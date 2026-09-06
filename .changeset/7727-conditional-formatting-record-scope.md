---
'@object-ui/app-shell': minor
---

Lint conditional-formatting conditions in the `record` scope, and stop advertising
`data` (objectui#7727).

**Breaking for authors, deliberately.** A bare field reference in a list/grid/kanban
`conditionalFormatting` condition — `status == 'overdue'` — used to lint clean in
Studio's conditional-formatting editor and now raises a blocking error carrying the
`record.status` fix.

The editor was the last place still teaching a spelling the runtime had already
retired. objectui#5741 (Phase 2 of the objectui#5330 canon, ruled 2026-09-02 and
amended 2026-09-05) unbound the bare shorthand and `data.*` on runtime record
surfaces: `evalRowPredicate` binds the row as `record.*` and nothing else, so
`status == 'overdue'` faults with `Unknown variable: status` and the authored rule
never matches. The editor nevertheless linted it green, because it authored in the
`flattened` scope — where any bare identifier is legal. That is declared-but-unenforced
in the direction that costs an author a silently dead formatting rule.

Three changes, all on `ConditionalFormattingEditor`:

- its `CelPredicateField` authors in `scope="record"`, the scope the field conditional
  rules `visibleWhen` / `readonlyWhen` / `requiredWhen` already use;
- the exported `ROW_PREDICATE_ROOTS` loses `'data'`, which Phase 2 retired but
  autocomplete was still recommending;
- the docblock and inline comment that described the old three-way binding are
  rewritten to the one binding that survives.

The `flattened` default at the shared authoring seam is **untouched**: RLS predicates
and flow conditions are not row surfaces (objectui#5738 stand-down 3) and stay
flattened.

**Known gap this makes reachable:** `app.*` is bound at runtime by the app-shell
predicate scope and advertised by this editor, but `@objectstack/formula`'s
`SCOPE_ROOTS` has no `app`, so under `scope="record"` the lint refuses it. Measured,
pinned as a characterization test, and filed as objectui#8155.
