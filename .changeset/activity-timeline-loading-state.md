---
"@object-ui/plugin-detail": patch
---

A fetching activity feed says "loading", not "No activity recorded" (objectui#3205).

`RecordActivityTimeline` declared a `loading` prop and destructured it straight
into `_loading`, so nothing in the component ever read it. For the whole
duration of a feed fetch the panel therefore rendered the empty state — "No
activity recorded" — and then contradicted itself when the rows landed. The
empty copy is a factual claim about the record; it may only be made once the
fetch that would fill the feed has settled.

The timeline now branches on `loading` **before** the empty branch and renders a
spinner row (`role="status"`, `aria-live="polite"`) while the feed is in flight.
`collapseWhenEmpty` does not suppress it: that flag is about the empty state
("collapse when there are no items"), and mid-fetch it is not yet known whether
there are items.

The guard is `loading && filtered.length === 0`, not `loading` alone — a refresh
or a "Load more" round-trip keeps the rows already on screen instead of blanking
them (that button carries its own spinner).

No prop or signature changed: the fix is that the declared prop is now read.
`record:activity` has computed a live `loading` since objectui#3165 (true during
its self-fetch) and `RecordChatterPanel` already forwarded it in both positions,
so the whole chain now shows a loading state end to end.
