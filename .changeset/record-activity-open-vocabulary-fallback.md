---
'@object-ui/plugin-detail': patch
---

`record:activity` renders an author-extended `sys_activity.type` instead of dropping it

**Behaviour change.** `activityRowToFeedItem` used to return `null` for any
`sys_activity.type` outside `ACTIVITY_TYPE_TO_FEED_TYPE`: the row was stored,
queryable and invisible, with only a console warning to say so. It now renders
through a defined fallback presentation (`UNMAPPED_ACTIVITY_FEED_TYPE`, the
generic `system` feed type), still announced once per distinct type.

This follows the maintainer ruling of 2026-08-24 on objectstack#11507,
direction 4: `sys_activity.type` is **author-extensible**. Every field on
`sys_activity` is `readonly: true` and objectql's `validateRecord` skips
readonly fields on both write branches, and ADR-0052 §5b.2 forwards an author's
`activityMilestones[].type` into the column verbatim — so a value the platform
never declared is legitimate stored data, not a mistake, and dropping it
reproduces the objectui#5840 failure for every author who writes one.

The types this map deliberately excludes (`commented` / `mentioned` / `login` /
`logout` → `undefined`) are unchanged: those are decisions, not gaps, and they
still return `null` silently. `ACTIVITY_TYPE_TO_FEED_TYPE` itself is unchanged,
so the copy `RecordDetailView` reads is unaffected.

The pin that goes with it replaces the set-equality check objectui#5840 removed,
and is deliberately two-directional: the map must cover every **built-in** type
(superset — a new built-in turns it red), and an unknown type must reach the
feed through the fallback (never dropped, never crashing). Set equality is not
asserted in either spelling, and the docblock says so, because pinning to the
closed declaration is what made #5840 drop stored rows.
