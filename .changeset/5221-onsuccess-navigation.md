---
'@object-ui/core': minor
'@object-ui/app-shell': minor
---

Console half of `ActionSchema.onSuccess` post-success navigation.

`@objectstack/spec` declares `onSuccess` as a closed strict object
`{ navigate: string, openIn: 'self' | 'newTab' }`, refine-scoped to `type: 'api'` and
`type: 'script'` — the two action types whose success event carries a server response.
Nothing in this renderer read it, so an action declaring the hop navigated nowhere: the
block fell into `ActionRunner`'s older `ActionDef.onSuccess` chained-callback channel,
was dispatched as an action, and failed inside `executeNavigation` with "No URL provided
for navigation action" — a red toast and no jump. The motivating report is a clone action
that leaves the user sitting on the record they cloned from.

`ActionRunner.handlePostExecution` now performs the declared hop through
`navigationHandler` — the same SPA seam every other navigator in that file uses, which
the console wires to react-router's `navigate`, so `openIn: 'self'` is a real in-place
route hop rather than a full-page load. `interpolateTarget` gains a `${result.*}` scope
alongside `${param.*}` and `${ctx.*}`, resolved against the handler's own return value
(the level `readActionPayload` reads, one below the action envelope) and supplied only by
this call site, so a target interpolated before its request still has no `result` to
name. `openIn` is read as the one member that changes the branch and no default is
written here — the spec materialises `.default('self')`, so parse output always carries a
resolved member — and the two `openIn` spellings stay apart: this reads
`onSuccess.openIn` (`'self' | 'newTab'`), never the top-level `type: 'url'` switch
(`'self' | 'new-tab'`), each of which spec refuses in the other's position.

The console's server-action wrapper gains the matching handler-return half: a handler may
now return `openIn: 'self'` next to its `redirectUrl` to ask for the same-tab jump, while
a `redirectUrl` **without** `openIn` keeps its shipped new-tab behaviour unchanged. When
an action declares an `onSuccess` block, the wrapper defers to the runner and only tidies
its pre-opened tab, so one navigation happens rather than two.

The pre-existing `ActionDef.onSuccess` chained-callback channel is unchanged. It is told
apart by the spec's own declaration — a non-array object whose `navigate` is a string —
and keeps running for every other shape.
