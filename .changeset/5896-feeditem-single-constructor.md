---
'@object-ui/plugin-detail': minor
'@object-ui/app-shell': minor
---

One `sys_activity` row → `FeedItem` constructor, and the console record page
stops dropping author-extended activity types in silence (objectui#5896).

**The defect.** `RecordDetailView`'s `sys_activity` merge read the shared type
table (objectui#5878) and then built the `FeedItem` itself, ending in
`if (!feedType) continue;`. That one `continue` collapsed two different
situations: a type the table maps to `undefined` **on purpose** (`commented` /
`mentioned` / `login` / `logout`), and a type the table has never heard of. The
second is an **author-extended** value — `sys_activity.type` is
author-extensible (objectstack#11507 direction 4, ruled 2026-08-24), every
column on that table is `readonly` so objectql never validates a write, and
ADR-0052 §5b.2 forwards an author's `activityMilestones[].type` into it
verbatim. So an activity that happened, was written and is queryable had no row
on the console record page: no placeholder, no empty state, no console message.
Stored, queryable, invisible — objectui#5840's failure mode reached by another
route, and one objectui#5969 (PR #6112) had already removed from the block
side, leaving the two surfaces disagreeing about the same row of the same table.

**The fix is convergence, not a second decision.** `@object-ui/plugin-detail`
now exports the whole reading — `activityRowToFeedItem`,
`UNMAPPED_ACTIVITY_FEED_TYPE` and the `resetUnknownActivityTypeWarnings` test
seam alongside `ACTIVITY_TYPE_TO_FEED_TYPE` — and `RecordDetailView` calls the
constructor instead of paraphrasing it. Publishing the table alone had left the
mirror one level up, and it had already drifted three ways: the silent drop, a
timestamp fallback that could leave `createdAt` `undefined` where the helper
yields `''`, and a second hand-written system-actor lookup.

**Behaviour change on the console record page** (breaking in the objectui sense,
shipped `minor` — objectui's `major` tracks `@objectstack`):

- an unmapped `sys_activity.type` now **renders** through the generic
  `UNMAPPED_ACTIVITY_FEED_TYPE` (`'system'`) presentation instead of vanishing,
  and is announced once per distinct value on `console.warn` — a **missing
  decision**, not lost data: the row is visible, what it lacks is its own icon
  and colour. `FeedItemType` is a closed spec enum, so minting a kind for "we
  don't know" would be a platform change, not this surface's.
- `createdAt` is always a string for a row with neither a usable `timestamp`
  nor a `created_at`.

**Unchanged, deliberately:** the four exclusions still produce no row and no
warning. They are decisions — comment content lives in `sys_comment`, and
login/logout are account events rather than record activity — and a warning
about a decision teaches authors to ignore the channel.
