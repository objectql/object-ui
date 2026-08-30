---
"@object-ui/console": patch
---

Approvals inbox: the queue rows and the amount sort now honour each request
object's own `hidden: true` field declaration (objectui#6020).

The `hidden: true` trim added for the drawer summary card reached only the
drawer — the desktop queue row, the mobile card and the amount comparator
still read the field, so an amount an app author declared hidden rendered
inline in the queue and ordered the list, which leaked its relative magnitude
even to a viewer who never saw the figure.

The queue spans many objects, so the trim is a per-object lookup and every row
is answered about its own object; a row left with no renderable amount now
sorts with the other amount-less rows. `hidden` stays a UI contract
(objectstack#10749) and the filter still fails open: an unanswered or failed
metadata read renders today's figure.
