---
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-view': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-gantt': patch
---

The settled-schema convergence, and the gantt's duplicate query gated
(objectui#7225, maintainer ruling B, 2026-09-02).

`useSettledSchema` was extracted and published in PR #6690 with exactly **one**
non-test adopter (`ObjectTree`, the component that had an actual defect —
objectui#6481's unkeyed latch). `ObjectKanban`, `plugin-view/ObjectView` and
`ObjectCalendar` kept their own hand copies of the same shape, so a published
export was owed compatibility forever **and** the duplication it was named for
stayed. All three now call the hook.

The migration is a pure deduplication with no behaviour delta — the hook was
extracted *from* these three shapes, so each becomes a one-line call.
`ObjectCalendar`, which objectui#6482 named as the obstacle, fits via the
recipe the hook's own doc comment prescribes for it by name: pass the data
source as `undefined` for a render that must not read metadata
(`hasInlineData ? undefined : dataSource`), so "inline value data set" is
expressed as "there is no source to read from" rather than as a second enable
flag. GATE PLACEMENT stays local in all three, which is what #6482 ruled and
what made the calendar's obstacle a non-obstacle: it was about the gate half.

**One observable change:** `ObjectKanban`'s rejected definition read now logs
on `console.error` with a `[useSettledSchema]` prefix instead of
`console.warn`. Its test spy moves with it, and now asserts on the channel
rather than merely silencing it.

**The gantt's duplicate query is gated** (ask 2 of the card; #6482's
undischarged half). `ObjectGantt` listed `objectSchema` in `reload`'s
dependency list, so every load issued two unbounded queries — the first with no
`$expand` at all. Measured on this component across three latency profiles, the
cost is not the mild "round trip bought and thrown away": when the metadata
read is the slower of the two, which is the common case on a cold
`MetadataCache`, the user sees the full three-step paint — raw foreign-key ids,
back to the loading placeholder, then the expanded rows. It now issues one
query, already expanded.

Gating the gantt required its schema resolution to settle on EVERY exit
(objectui#7232): the hand-rolled effect returned without settling on
`!effectiveDataSource`, on `!resource` and in its `catch` — harmless while
nothing waited on it, and a chart that never loads once something does.
`useSettledSchema` settles on all three by construction, which is what makes
the gate safe; both exits are pinned.

⛔ Gating is not capping. The row ceiling on these fetches is objectui#7210's
separate ruling, in its own commit on the same branch.
