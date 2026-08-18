---
'@object-ui/app-shell': patch
---

The metadata editor's option pickers and the Audit tab distinguish a FAILED load from a completed one that found nothing.

Four loaders in `views/metadata-admin` caught a failed request by writing the
value a successful empty response writes, so a fault and a measurement became
the same state.

**The three option-picker loaders in `ResourceEditPage`** (objectui#5170) — the
object name list, the bound object's fields + actions, and the bound object's
views — wrote the empty array in the `catch` and flipped loading to false, with
no error state, no banner and (unlike objectui#5110) not even a `console.error`.
`client.list()` / `client.get()` throw for every non-ok status other than the
404s they map to an empty result, so refusals, dropped connections, expired
sessions and unparseable bodies were all rendered as a completed, empty picker.
The pickers' empty-state copy is not neutral about it either: `ref:object` says
"object_name (no objects detected)", a measurement, and `field-ref` / `view-ref`
say "No object bound" when an object IS bound. An operator authoring a view, a
permission row or an action read that as the metadata graph's answer, and an
author who concludes "this object has no fields" tends to go and create one.

**The Audit tab** (objectui#5169) set an error AND zeroed `events`, and nothing
gated the count or the empty branch on that error, so a failed read rendered the
rose failure banner, a header count of `0 events`, and "No audit events yet — no
save, publish, rollback, delete or reset attempts have been recorded for this
item" all at once, contradicting each other. This is the surface people read for
compliance-shaped questions, so the false zero was the half that mattered.

All four now run through one four-arm `LoadState` (`idle` / `loading` / `loaded`
/ `error`, `views/metadata-admin/loadState.ts`), matching the union objectui#5110
landed for the References panel, so no value is both a failure and a
measurement. The pickers gained a shared failure state that says the list did
not load, shows the cause, and makes no claim in either direction about whether
options exist; the field and view pickers also gained the `loading` arm, which
the existing `objectFieldsLoading` / `objectViewsLoading` context flags already
described but no picker rendered. The Audit tab's count and empty state are now
reachable only from a completed read.

Both empty states are unchanged and still reserved for a load that completed and
found nothing — the one case where "no objects detected" and "no attempts have
been recorded" are true. New `engine.form.optionsLoadFailedTitle` /
`optionsLoadFailedDesc` / `loadingOptions` and `engine.edit.auditErrorTitle` /
`auditErrorDescription` keys in the designer's `en` and `zh` tables.
