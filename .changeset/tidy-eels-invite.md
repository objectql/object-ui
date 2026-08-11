---
'@object-ui/app-shell': minor
---

fix(app-shell): a transient 404 no longer retires the shared inbox feed for the page's lifetime

`sharedUserFeeds`' `markUnavailable()` was a one-way door: `refresh`, `schedule`
and `onVisibilityChange` all returned early on `unavailable`, so a feed that took
one missing-resource answer stayed retired until the user reloaded the page or
switched identity. Since #4225 pointed both the header bell and Home's action
centre at one inbox feed, that took both panels together — reproducing the
#4110 / #4230 dead-bell signature from a lost race rather than from a real
absence.

The split is reachable because `isMissingResource` is status-shaped
(`httpStatus === 404` alone qualifies) and the ObjectStack client stamps
`httpStatus` from the response status before it reads the body — so a 404 from
anywhere in the transport arrives indistinguishable from the registry's
considered `OBJECT_NOT_FOUND`.

A retired feed now re-probes at most `UNAVAILABLE_PROBE_LIMIT` (3) times, no
more often than `UNAVAILABLE_PROBE_MS` (60s), on the poll timer and on
`visibilitychange` alike; a probe that answers with rows revives the feed and
restores its normal cadence. The retired state itself is unchanged — status
stays `ready`, the value stays empty, and no error is ever rendered — so a
deployment that genuinely has no messaging pipeline still reads as an answer and
now costs three extra reads across the whole page rather than one.
