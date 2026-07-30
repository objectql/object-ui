---
"@object-ui/plugin-form": patch
---

fix(plugin-form): swapping `recordId` no longer leaves the previous record on screen

`loading` in `ModalForm` / `DrawerForm` / `TabbedForm` / `SplitForm` was only ever
set `true` once, by `useState(true)`, and thereafter only ever set `false`. A
`recordId` change therefore re-entered the fetch effect **without** going back
through the loading branch: the form stayed mounted showing — and accepting edits
to — record A's values, with nothing indicating a different record had been asked
for, until B's response landed and replaced them in place. Anything typed in that
window read as A's on screen and would have been submitted against B.

The same effect had no staleness guard either, so two overlapping reads landed in
**completion** order rather than request order: ask for B then C, and a slow B
arriving last left the form showing B while the caller had asked for C.

Both are the same defect from the user's side — the form displays a record nobody
asked for — so both are fixed:

- a change of record re-enters the loading state before the read, so the previous
  record is off screen while the next one is in flight. Gated on the record
  actually changing: the effect also re-runs on `initialData`/`initialValues`
  identity churn (callers rebuild those objects every render), and flashing the
  loading state for that would thrash;
- the effect's cleanup marks its read stale, so a response that is no longer the
  one being awaited is dropped instead of overwriting a newer record.

`ObjectForm` already re-entered loading before its fetch, which is why this only
ever reproduced on the four sectioned variants.

**Also fixed, a consequence of the above:** hiding the form unmounts the inner
renderer, and that renderer is the only thing that reports dirtiness via
`onDirtyChange` — it gets no chance to report `false` on the way out. Without
clearing the flag, the overlay's unsaved-input guards would stay armed for input
belonging to a record no longer on screen: a plain refresh would prompt, and
closing would offer to discard nothing.
