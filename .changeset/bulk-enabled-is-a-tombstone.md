---
"@object-ui/plugin-grid": patch
"@object-ui/types": patch
"@object-ui/app-shell": patch
---

fix(grid): drop the `bulkEnabled` derivation — the spec key is a tombstone

Follow-up to objectui#3002 / #3031. That change folded two sources into the
selection bar: a view's `bulkActions` names resolved against
`objectDef.actions`, and object actions declaring `ActionSchema.bulkEnabled`.
The second source is dead.

`@objectstack/spec` 17.0.0 retired `action.bulkEnabled` in the #3896 audit
close-out (framework#4054, landed while #3031 was in flight — the spec source
still carried the key when its design was settled). It is now a `retiredKey()`
tombstone, so it is not merely ignored: `defineStack` **hard-rejects** a config
that sets it, and the backend refuses to boot. Browser verification against a
real showcase backend is what surfaced this — the derivation branch could never
run, and #3031's changeset pointed authors at a key that breaks their app.

The tombstone's own prescription is the path that survives:

> the multi-select toolbar is driven by the LIST VIEW's `bulkActions` /
> `bulkActionDefs`, never by this flag … declare the action in the view's
> `bulkActions` instead.

So `resolveBulkActions` now folds exactly two vocabularies — inline-authored
`bulkActionDefs`, and `bulkActions` names promoted to their declared object
action — which is what #3031's other half already did and what the end-to-end
run exercised: naming `showcase_mark_done` in the view's `bulkActions` issued
one `POST /api/v1/actions/showcase_task/showcase_mark_done` per selected
record (10/10 → `done: true, progress: 100` server-side). Everything downstream
of the fold is unchanged: promoted defs still carry the action's label, icon,
`visible`, confirm text and params; still run through `BulkActionDialog`
(params → confirm → progress → result); still dispatch per record with
`_rowRecord` attached; still attribute failures per record.

A stale `bulkEnabled: true` on an object action is now inert rather than a
second path into the bar. Note tsc cannot catch this class of drift here — the
fold reads a loosely-typed `NamedActionDef` with an index signature, so the
retired key never surfaces as `never`.
