---
'@object-ui/app-shell': minor
---

Lint conditional-formatting conditions in the `record` scope, and stop advertising
`data` (objectui#7727).

**Breaking for authors, deliberately.** A bare field reference in a list/grid/kanban
`conditionalFormatting` condition — `status == 'overdue'` — used to lint clean in
Studio's conditional-formatting editor and now raises a blocking error carrying the
`record.status` fix.

**Read this before upgrading.** The error is a *blocking* one: it bubbles through
`onBlockingIssuesChange` (objectui#4527), which the inspector aggregates and the host
that owns Save reads. So an already-saved view whose `conditionalFormatting` carries a
legacy bare condition becomes **unsavable in the designer until that condition is
rewritten** — including when you opened the view to change something unrelated. Nothing
is migrated automatically and nothing at runtime changes: those conditions were already
dead (see below), the editor just stops hiding it. Rewrite `status == 'overdue'` as
`record.status == 'overdue'`.

The editor was teaching a spelling the runtime had already retired. objectui#5741
(Phase 2 of the objectui#5330 canon, ruled 2026-09-02 and amended 2026-09-05) unbound
the bare shorthand and `data.*` on runtime record surfaces: `evalRowPredicate` binds the
row as `record.*` and nothing else, so `status == 'overdue'` faults with
`Unknown variable: status` and the authored rule never matches. The editor nevertheless
linted it green, because it authored in the `flattened` scope — where any bare
identifier is legal. That is declared-but-unenforced in the direction that costs an
author a silently dead formatting rule.

Three changes, all on `ConditionalFormattingEditor`:

- its `CelPredicateField` authors in `scope="record"`, the scope the field conditional
  rules `visibleWhen` / `readonlyWhen` / `requiredWhen` already use;
- `ROW_PREDICATE_ROOTS` loses `'data'`, which Phase 2 retired but autocomplete was
  still recommending. It is an `export const`, but **not** on this package's
  published face: `@object-ui/app-shell`'s `index.ts` has no `export *` lines and
  re-exports neither the const nor this editor, and the package `exports` map is
  `"."` plus `./styles.css` with no deep subpath — so no consumer outside the
  package can import it, and nothing you depend on changes shape;
- the docblock and inline comment that described the old three-way binding are
  rewritten to the one binding that survives.

**Autocomplete moves with the scope.** Under `scope="record"`, `CelPredicateField`
builds its bare-position catalog with `fields: []`, so typing `sta` at the start of a
condition no longer offers `status`; fields are offered as member completion after
`record.` instead. That is the correct affordance for the new scope — the bare form it
used to complete is now an error — and the member-completion list itself is unchanged:
the engine's `introspectScope` returns byte-identical `fields` for `record` and
`flattened` (measured against `@objectstack/formula@17.2.0`; it echoes the caller's
`fields` hint rather than deriving one per scope).

The `flattened` default at the shared authoring seam is **untouched**: RLS predicates
and flow conditions are not row surfaces (objectui#5738 stand-down 3) and stay
flattened.

**What this does NOT close — two halves are left open, both filed.**

- **The `data.*` half.** Dropping `'data'` from `ROW_PREDICATE_ROOTS` stops
  *recommending* it; it does not stop the lint *accepting* it.
  `@objectstack/formula`'s `SCOPE_ROOTS` lists `data`, so `data.status == 'x'` still
  lints clean at `scope:'record'` while resolving against the host's ambient `data`
  rather than the row — constant-false, silently. Pinned here as a characterization
  test, tracked as objectui#8166. This changeset closes the **bare-field** half of the
  retirement only.
- **The `app` root.** `app` is bound at runtime by app-shell's predicate scope and
  advertised by this editor, but `SCOPE_ROOTS` has no `app`, so under `scope="record"`
  the lint now refuses it. Measured, pinned, and filed as objectui#8155.

⛔ And this editor is **not** the last authoring site still on the flattened default —
`ConditionBuilder` reaches it by passing no `scope` at all, which is why a grep for the
explicit spelling missed it. An action's `visible` / `disabled` guard is a row predicate
by the canon's own words and still lints bare refs clean. Filed as objectui#8167; ⛔ not
fixed here, because three of `ConditionBuilder`'s six callers need a per-surface tier
verdict first.
