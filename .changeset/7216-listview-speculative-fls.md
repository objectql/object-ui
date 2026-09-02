---
'@object-ui/plugin-list': patch
---

FLS-gate the speculative half of `ListView`'s `$select` projection (objectui#7216).

`ListView` builds `$select` from two populations and, until now, asked them different
questions. The user-declared `columns` were passed through `perms.checkField(...)` by
objectui#6898. Everything the builder adds ON TOP — the kanban / gantt / timeline /
calendar / gallery field bindings, the timeline's auto-added `status` / `priority`
badge fields, and the operands harvested from row-action and conditional-formatting
predicates (objectui#3501) — went through `addSpeculative`, which intersected them
against the object's declared fields and then added them unconditionally.

The two gates it needed answer unrelated questions and neither substitutes for the
other. The known-field gate keeps an **unknown** key out, because some backends answer
an unknown `$select` key with an empty result set rather than ignoring it. The FLS gate
keeps a **known but denied** key out, because sending it leaks the value at the server
boundary even though the UI hides it. A field can be perfectly well-declared and still
denied, and that was the case this path did not handle: a kanban grouped by a denied
field, or a gantt bound to a denied date, still named it in the request.

**Reproduced before it was fixed.** Eight of fourteen new pins fail on the unmodified
tree, each reaching the denied field only through a view binding — a denied *column* has
been dropped since objectui#6898, so a pin naming one would have proved nothing.

The gate goes inside `addSpeculative` rather than at the five call sites, so every route
into the speculative union is covered at once; gating call sites one at a time is how
the asymmetry arose. It runs **after** the known-field intersection, the ordering
objectui#7179 established: `checkField` answers false for an undeclared key, so asking
it first would drop derived and computed bindings — and would be the reason they were
dropped. The platform record columns (`created_at`, `owner_id`, the audit FKs) are
carved out for the reason they already are elsewhere in this builder: every object
carries them and none declares them, so no field policy mentions them and an FLS answer
about them is always false. Without the carve-out a calendar bound to `created_at` would
go blank for everybody.

**Nothing a permitted view did stops working.** A permitted binding is still projected,
an unanswered permission policy filters nothing, and the projection is rebuilt when the
policy answers — pinned, because a gate that only runs before `/me/permissions` resolves
is a dead gate that passes almost every test written for it.

objectui#7179's `addGroupingField` wrapper is removed: its predicate was identical to
the one now inside `addSpeculative`, and two spellings of one gate is the shape that
lets them drift. That path keeps its behaviour and gains the FLS pin it never had.
