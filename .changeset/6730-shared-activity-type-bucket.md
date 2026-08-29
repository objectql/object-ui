---
'@object-ui/app-shell': minor
'@object-ui/i18n': patch
---

The shell's `sys_activity.type` reading stops calling every unrecognised type an
update (objectui#6730).

`mapActivityRows` in `hooks/sharedUserFeeds.ts` — the feed behind the AppHeader
bell's Activity tab, Home's activity card and the exported `ActivityFeed` panel
— carried the third hand-written reading of that column in this repo, and it
bucketed every value outside `created` / `deleted` / `commented` / `mentioned`
as `update`. That is not a missing decision; it is a wrong one stated out loud:
a `scheduled` meeting, a `login`, a nightly `system` rollup and an author's
`contract_countersigned` all rendered as "somebody updated this record".

- New `layout/activityItemType.ts` holds the whole reading — the table, the
  generic bucket, the `"NOW()"` timestamp fallback and the row constructor that
  applies all three — DOM-free, so what a row becomes is assertable directly.
- `ActivityItem['type']` gains a fifth kind, `system`: the generic bucket, with
  its own icon, label and notification toggle. Following
  `UNMAPPED_ACTIVITY_FEED_TYPE`'s precedent, an unrecognised value renders
  through it and is named once on `console.warn` rather than being dropped —
  `sys_activity.type` is author-extensible (objectstack#11507 direction 4), so
  an unmapped value is real activity nobody has ruled on, not a mistake.
- The built-ins that had no honest presentation among the four existing kinds —
  `system`, `completed`, `scheduled`, `login`, `logout` — now land in that
  bucket instead of claiming `update`. `assigned` and `shared` stay `update`:
  both write to the record.

⛔ The two readings of this column are deliberately NOT converged.
`activityRowToFeedItem` builds a `FeedItem`, and the vocabularies cross:
`FeedItem` collapses create/update/delete into one `field_change` and drops
`commented` / `mentioned` outright, so routing this surface through it would
cost the bell every comment row and every create/delete distinction. What is
shared is a pin, not an import — the new suite reads plugin-detail's real table
(a devDependency; no runtime edge) and fails when the declared vocabulary grows
an entry this side has not read, or when the two readings stop disagreeing in
the three measured ways.
