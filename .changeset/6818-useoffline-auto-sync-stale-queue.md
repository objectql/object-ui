---
'@object-ui/react': minor
---

`useOffline` auto-syncs mutations queued while already online (objectui#6818).

The auto-sync effect was keyed `[isOnline, enabled]` with
`react-hooks/exhaustive-deps` suppressed, so its `queue.length === 0` guard was
evaluated against the queue as it stood when `isOnline` or `enabled` last
changed. `queueMutation` has never been conditional on being offline — it
accepts entries whenever the hook is enabled — so anything queued while ALREADY
online found the effect asleep, and nothing re-ran it. Only an explicit `sync()`
drained those mutations; the hook whose job is auto-sync did nothing for them.

The suppression's stated reason ("only trigger on `isOnline` changes, not on
every queue change") was about TIMER RESTARTS, and it is kept: the effect is
keyed on the **boolean** `queue.length > 0`, never on `queue` or `queue.length`,
so queueing a second mutation while the 100ms stabilization timer is already
armed still does not re-run the effect or restart the timer. What the
suppression never justified — the early return against a stale snapshot — is
what changed.

`sync` also read `batchSize` through a ref (newest) while reading `queue` from
its own closure (a snapshot), so the two halves of one call disagreed about how
current they were, and the auto-sync effect retains such a closure by design.
The queue now reaches `sync` through the same commit-phase mirror the sync
config uses, so both halves are the newest committed values. That also takes
`queue` out of `sync`'s dependency list: `sync` is keyed `[enabled]` and is
stable across queued mutations, which is what lets the effect name every value
it reads and drop the `eslint-disable` entirely rather than reword it.

**Behaviour change, graded `minor` deliberately.** `useOffline` is published and
its out-of-repo population is unmeasured; the single in-repo caller
(`AppHeader`) destructures `isOnline` only and is unaffected. A consumer that
called `queueMutation` while online and relied on nothing being sent until it
called `sync()` itself will now see that mutation flushed ~100ms later.
`sync`'s identity is also more stable than before — it no longer changes on
every queued mutation — which is safe for effects keyed on it but is a visible
difference.

Not changed here: a `batchSize` smaller than the queue still drains one batch
and leaves the remainder for the next transition, because whether one auto-sync
should chain batches until the queue is empty is a separate question about what
`batchSize` means, not about this guard.
