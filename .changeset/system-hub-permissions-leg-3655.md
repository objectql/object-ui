---
'@object-ui/console': patch
---

Point System Hub's Permissions card — both its link and its count — at `sys_permission_set`, closing the last of the five `system/*` navigation targets (objectui#3655).

Four of those URLs became redirects in an earlier change; `system/permissions` was deliberately held back, and so was the count beside it, because the framework splits what this console calls "Permissions" into two Setup entries and picking one would have silently bound every click, bookmark and badge to a surface nobody chose:

- `sys_capability` — ADR-0066 layer 1, the definition registry of "what can be done". Its own docblock notes it is what the ADR "loosely floats" as `sys_permission`, which is the name the retired page and the count query both used, so lineage pointed here.
- `sys_permission_set` — ADR-0066 layer 2, the grant container the permissions docs call "the only capability container" (object CRUD, field security, access depth, system capabilities), so function pointed here.

It is decided as `sys_permission_set`: the card reads "Manage permission rules and assignments", and rules-and-assignments is layer 2 — a capability is what a permission set references by name, not what an administrator is assigned. Two user-visible consequences:

- `/apps/:app/system/permissions` now forwards in one hop to `/apps/:app/sys_permission_set` instead of being rewritten to `…/system/record/permissions` and rendering a record detail page for an object literally named `system` — a dead link that read as a backend fault.
- The Permissions card's badge shows the real number of permission sets. It previously counted `sys_permission`, an object the framework does not register; the adapter absorbs that `404` into an empty page on purpose, so the card printed a confident `0` no administrator could tell apart from "there really are none".

Recorded as a transitional alias. Retiring this hand-written card wall along with the hub (already `@deprecated` in favour of the metadata-driven navigation) remains open and does not conflict — a redirect keeps old bookmarks resolving either way.
