---
'@object-ui/app-shell': minor
---

Lint conditional-formatting conditions in the `record` scope, stop advertising `data`
(objectui#7727), and align the predicate scope's root vocabulary to the engine's —
`app` is removed, `os` is advertised (objectui#8155).

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

On `ConditionalFormattingEditor`:

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

## The `app` root is removed from the predicate scope (objectui#8155)

Ruled 2026-09-07. `app` was the mirror of the bug above, one level up: app-shell
*bound* it, this editor *advertised* it, and the engine that lints the very same field
*refused* it — ADR-0068 declares `current_user` with the `user` / `ctx.user` aliases
and nothing named `app`, and `@objectstack/formula`'s `SCOPE_ROOTS` has no `app`
either. So `app.name == 'crm'` raised a blocking error whose suggested remedy,
`record.app`, was nonsense, and there was **no** spelling that both linted clean and
resolved. The ruling is that the engine's `SCOPE_ROOTS` is the contract and this
consumer aligns to it, rather than the engine growing a root to match this consumer.

`buildExpressionScope` (`providers/ExpressionProvider.tsx`) therefore no longer binds
`app`, and `ROW_PREDICATE_ROOTS` no longer advertises it.

⚠️ **This is breaking for anyone whose saved metadata spells `app.*`, and that
population cannot be measured from this repository.** In-tree usage is zero — swept
across `packages/`, `apps/`, `examples/` and `content/` with a firing control — but
metadata authored in real deployments lives outside this tree and no sweep here can
see it. Any predicate that reads `app.*` stops resolving. There is no replacement
root: `app` was never in the protocol. If you need a "current app" value in a
predicate, that is a spec/engine vocabulary widening to be filed fresh — the
producer-side card objectstack#16420 was closed `not_planned` by the same ruling
(2026-09-07), so there is no open record waiting for it.

**What a stale `app.*` predicate does now depends on the surface — the direction is
NOT uniform, and two of them fail the safe way.** Measured per surface on the merged
head, each with a resolvable control predicate firing in the same run:

| Surface | Entry point | A stale `app.*` predicate now |
|---|---|---|
| Conditional-formatting `condition` | `resolveConditionalFormatting` → `evalRowPredicate` (`fallback: false`) | **fails CLOSED** — the rule silently stops matching, no style is applied |
| Row/header action `visible` / `disabled` | `evalRowPredicate` (`fallback: false`) | **fails CLOSED** — the action is hidden / left enabled |
| Action `visible` on `action-button` / `action-menu` / `action-bar` | `useCondition(…, { throwOnError: true })` | **fails CLOSED** — hidden, with a one-time console warning |
| Action `visible` on `action-icon` / `action-group` | `useCondition` (default) | **fails OPEN** — the action is shown |
| Field `visibleWhen` (form field rules) | `resolveFieldRuleState` → `evalFieldPredicate` (fallback `true`) | **fails OPEN** — the field is shown |
| Field `visibleWhen` (app-shell object field) and nav / area `visible` | `isObjectFieldVisible` / `evaluateVisibility` | **fails OPEN** — shown, with a console diagnostic |
| Field `readonlyWhen` / `requiredWhen` | `resolveFieldRuleState` (fallback `false`) | **fails CLOSED** — not readonly, not required |

So the cost is not one shape: on the fail-OPEN surfaces a gate that used to hide
something starts showing it, and on the fail-CLOSED surfaces a rule that used to fire
silently stops. Both are accepted costs of the ruling, not oversights — but they need
opposite checks after upgrading, which is why they are listed apart rather than
summarised. Every faulting predicate warns on the console; the app-shell diagnostic
names the roots this tier really binds, and objectui#8155's follow-up removed `app`
from that list so it no longer sends an author back to the root that is the reason
(`packages/react/src/utils/visibilityDiagnostic.ts`).

`ExpressionProvider` still accepts an `app` prop and still publishes `app` on its React
**context value**, which components read as a plain value (`DashboardView` does). Only
the **expression scope** loses it — those are two different things, and only the second
was ever a CEL root.

## `os` is now advertised (same ruling, opposite direction)

`os` was the exact mirror: **bound** by `buildExpressionScope`, **accepted** by the
engine, and merely never offered — the one root an author could legitimately write but
would never be shown. It is also the spec's canonical identity spelling
(`os.user.id`) and the measured in-tree one: authored predicates spell
`record.owner == os.user.id` across `packages/core`, `packages/components` and
`packages/plugin-grid`, including a conditional-formatting `condition`. It joins
`ROW_PREDICATE_ROOTS`. This is additive — nothing that linted clean before stops doing
so.

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

**What this does NOT close — one half is left open, and it is filed.**

- **The `data.*` half.** Dropping `'data'` from `ROW_PREDICATE_ROOTS` stops
  *recommending* it; it does not stop the lint *accepting* it.
  `@objectstack/formula`'s `SCOPE_ROOTS` lists `data`, so `data.status == 'x'` still
  lints clean at `scope:'record'` while resolving against the host's ambient `data`
  rather than the row — constant-false, silently. Pinned here as a characterization
  test, tracked as objectui#8166. This changeset closes the **bare-field** half of the
  retirement only.

⛔ And this editor is **not** the last authoring site still on the flattened default —
`ConditionBuilder` reaches it by passing no `scope` at all, which is why a grep for the
explicit spelling missed it. An action's `visible` / `disabled` guard is a row predicate
by the canon's own words and still lints bare refs clean. Filed as objectui#8167; ⛔ not
fixed here, because three of `ConditionBuilder`'s six callers need a per-surface tier
verdict first.
