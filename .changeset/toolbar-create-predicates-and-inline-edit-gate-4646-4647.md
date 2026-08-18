---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-list": patch
"@object-ui/react": patch
"@object-ui/core": patch
---

Related-list "+ New" now honours `userActions.create` predicates, and the grid
toolbar's inline-edit affordance is gated on `update` permission (objectui#4646,
objectui#4647).

Two declared-but-unenforced gaps on the same toolbar surface.

**#4646 — `createPredicates` had a producer and no consumer.**
`@objectstack/spec@17.0.0` widened `userActions.create` to
`z.union([z.boolean(), RowCrudActionOverrideSchema])`, so `resolveCrudAffordances`
emits `createPredicates` — and nothing in objectui read them, against roughly
fifteen consumption sites apiece for `editPredicates` / `deletePredicates`. The
symptom: a parent record entering a frozen state correctly greyed its children's
row Edit/Delete while the related list's "+ New" stayed fully live, so the user
filled in the whole child form to earn a server 409. The related-list toolbar now
evaluates `visibleWhen` / `disabledWhen` **once against the host parent record**,
per the spec docblock's binding for this key, on top of the existing
`o.create ∧ can(child, 'create')` check. `visibleWhen` hides "+ New" and fails
CLOSED; `disabledWhen` greys it and fails SOFT — the same evaluator, fail
directions and hidden-vs-disabled split the record header already uses for
edit/delete (objectui#4419 / PR #4515). A bare-boolean `userActions.create` is
untouched: with no predicates there is nothing to evaluate.

**#4647 — the inline-edit toggle was the one ungated affordance on its toolbar.**
It rendered on "grid view ∧ the host wired `onInlineEditChange` ∧ not the compact
toolbar", and every host wires that callback unconditionally. New and Import are
hidden for an account without the grant and the bulk-delete entry on the same
toolbar ANDs `can(obj, 'delete')`, but a read-only principal could flip inline
edit, modify cells and press "Save all" to earn a server 403. It is now gated on
the object's resolved edit affordance ∧ `can(object, 'update')`, mirroring that
bulk-delete gate. The gate is applied at all three sites that carry this
affordance — the wide toolbar's toggle, the compact toolbar's settings-popover
entry (which previously had no gate at all, not even the callback), and the
`editable` mode handed to the grid, so a stored view carrying `inlineEdit: true`
can no longer drop a read-only principal into editable cells with no toggle to
press.

`ListViewSchema.userActions.editInline` is also consumed now: an explicit `false`
withholds the affordance wholesale, which authors previously could not do.

**Behaviour change for read-only users, stated plainly.** Where the UI used to
offer inline editing and let the server refuse it, it now declines to offer the
entry point at all. No data access changes — the server gate was and remains the
enforcement boundary; this only stops the UI walking users into round-trips
guaranteed to fail. Accounts *with* the grant see no change, and hosts with no
`PermissionProvider` mounted (standalone embeds, the Studio designer) keep
today's behaviour, since `can()` answers `true` there by design.

One deliberate non-change: the absent case of `userActions.editInline` defers to
the host's existing `inlineEdit` channel rather than enforcing the spec's
`.default(false)`. Enforcing that default would remove the toggle from every
stored console list view in one release, since nothing folds a legacy key into
`editInline` and no existing view declares it. This follows the rule the
surrounding toolbar-flag block already states for itself — defaults chosen to
match what the flags have always done. `InterfaceListPage`, the key's other
consumer, reads the absent case as OFF, because the ADR-0047 interface page has
no such host channel to defer to.
