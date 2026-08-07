---
'@object-ui/console': patch
---

System Hub: a card count that failed to load no longer renders as `0`

Each count on the System Hub fetched one object and caught its own failure with
an empty page, so a 500, a 401, a 403 or a dropped connection all produced the
same confident `0` as a table that really is empty — no error, no retry, and no
way to tell the two apart. The most reachable case was a permission denial on a
single object: an administrator who may open the hub but cannot read
`sys_audit_log` was shown "0 entries" rather than being told anything at all.

A failed lookup now leaves that card's count unknown, and the badge — which
already renders only for a known count — is omitted, so the card shows no
number instead of a wrong one. The catch stays on each call rather than around
the batch, so one object's failure blanks only its own card and the cards beside
it keep the real numbers they received.

Unchanged: an object the backend does not have still counts `0`. The adapter
resolves an unregistered object as an empty page by design (callers read empty
as "feature unavailable"), so that never was an error and is not treated as one
here.
