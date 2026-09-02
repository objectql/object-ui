---
'@object-ui/plugin-gantt': patch
---

`ObjectGantt` no longer blanks the chart when one reload supersedes another

`reload()` already sequenced concurrent runs with `reloadSeqRef` and guarded every
result write with `isCurrent()`, but its `finally` was unguarded — so a **superseded**
reload still flipped `loading` / `refreshing` off. The stale run only had to finish
first, which is the ordinary case whenever a second reload is issued while the first
is still in flight: the placeholder was released, no rows had arrived, and the user
saw an empty chart until the fresh response landed.

The `finally` now clears the flags only when the run reaching it is still the current
one. It clears **both** flags rather than only the one its own `silent` mode set:
being current at that point means nothing is in flight any more, so clearing only its
own mode would strand the other flag whenever the superseded run used the other mode
— a silent toolbar refresh overtaken by a filter-change reload would have left the
refresh button busy for the life of the component.

This is the reload guard alone. Nothing about which queries are issued, how they are
projected or how they page changes.
