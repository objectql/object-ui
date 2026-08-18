---
'@object-ui/app-shell': patch
---

The metadata References panel distinguishes a FAILED reference check from a completed one that found nothing.

`ResourceEditPage`'s References loader held `refs: MetadataReference[] | null`
plus a `refsLoading` boolean, and the panel read `refs == null` as "still
loading". There was no value left to mean "the check failed", so the catch wrote
`setRefs([])` — the exact state a successful scan finding zero references
produces — and the panel rendered it as "Nothing in the metadata graph points at
this item. Safe to delete."

Every failure took that path: a refused request, a dropped connection, an
expired session, an unparseable body, and the truthful `501 NOT_IMPLEMENTED`
that `@objectstack/rest` now returns when the resolved protocol has no
`findReferencesToMeta` (objectstack#9326). `MetadataClient.references()` was
already correct — it returns `[]` only for a `404` and throws for every other
non-ok status — so the fault reached the component intact and was discarded
here. The single trace was a `console.error`. An operator is on this panel
precisely because they are about to delete something, and a failed safety check
was shown to them as an affirmative all-clear.

The pair is replaced by a four-arm discriminated union (`idle` / `loading` /
`loaded` / `error`), so a failure and a measurement are no longer expressible as
the same value. The error arm renders a distinct state: it says the check did
not complete, shows the cause, and deliberately makes no claim in either
direction about whether deleting is safe — the honest answer when the question
was not answered. It offers a Retry that re-runs the same loader (the old
re-entry guard, `refs != null`, would have refused a second attempt because the
catch had left `refs = []`). The reference count badge renders only for a
completed scan, so a failed check no longer displays a false `0`. New
`engine.edit.refsErrorTitle` / `refsErrorDesc` / `refsRetry` keys in the
designer's `en` and `zh` tables.

The empty state is unchanged and still reserved for a scan that completed and
found nothing — the one case where "Safe to delete" is true.
