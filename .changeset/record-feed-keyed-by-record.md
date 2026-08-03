---
"@object-ui/app-shell": patch
---

The record discussion panel no longer shows the PREVIOUS record's comments and
activity (objectui#3268).

FROM: clicking from record A to record B in a list left A's comments and
activity rows on B's discussion panel, with B's own rows merged in alongside
them. TO: each record's panel shows that record's feed and nothing else, and a
record that is still being fetched shows the loading row rather than the
record the user just came from.

This was cross-record data display, not a cosmetic glitch. `RecordDetailView`
is deliberately NOT remounted between records — no mount site passes a `key=`
(`console/AppContent.tsx`, and the `ObjectView` / `ObjectDataPage` /
`InterfaceListPage` drawers just swap `recordIdOverride`), per objectui#2269
"refresh data, don't rebuild UI" — so its feed state survived the navigation,
and both reads (`sys_comment`, `sys_activity`) merged into it BY ROW ID. A's
rows and B's rows have different ids, so the merge could not dedupe them away
and nothing anywhere reset the list.

It also suppressed the fix objectui#3209 had just shipped. On record→record
navigation `feedLoading` did flip true, but `RecordActivityTimeline`'s branch
is `loading && filtered.length === 0` (objectui#3205, deliberate: a refresh
must not turn an on-screen feed into a spinner) and the leftover rows kept
`filtered` non-empty — so the panel rendered the previous record's content
where a loading state belonged. The two issues only add up to a working
feature together.

The feed state is now keyed by `objectName:recordId` — the same key
objectui#3209 introduced in this file for the loading flag, and the very
`thread_id` the rows carry server-side. The render reads only the current
key's slice, so "empty for a new record" FALLS OUT of reading a key that has
no slice; there is no `setFeedItems([])` racing the fetch that fills it. A
response that lands after the user has navigated away is written under the key
its effect closed over, so it updates the record it was fetched for and can
never bleed into the record now on screen — the same guarantee `settledFeedKey`
already gave the loading flag. One idiom in this file, not two.

Keying rather than clearing is what keeps OPTIMISTIC rows safe. A comment the
user has just posted but that has not come back from the server lives only in
this state, and it now rides in its own record's slice: navigating away and
back finds it again, and it never appears on another record's panel. Nothing
deletes a slice, so returning to a record shows its rows immediately while the
re-read confirms them (objectui#3205 again), and the re-read folds the
persisted copy onto the optimistic row by id — same id, because that is the id
it was created under — so there is no duplicate when it lands. The same
scoping applies to threaded replies and reaction toggles.

No tolerance was added at the consumer. `RecordActivityTimeline` still keeps
`loading && filtered.length === 0` exactly as objectui#3205 wrote it; once the
feed's lifecycle is correct that condition is right on its own. Weakening it
would have been treating the symptom at the consumer, which is what
objectui#3165 / #3205 / #3209 all deliberately avoided.
