---
"@object-ui/plugin-detail": minor
---

`record:activity` fetches a feed instead of rendering a permanently empty one (objectui#3165).

The block published eleven inputs — `types`, `filterMode`, `showFilterToggle`,
`limit`, `showCompleted`, `unifiedTimeline`, `showCommentInput`,
`enableMentions`, `enableReactions`, `enableThreading`,
`showSubscriptionToggle` — every one of them a filter or an affordance over a
feed that could not have content on any path. `RecordActivityRenderer` called
`useRecordContext()`, discarded the result and rendered
`<RecordActivityTimeline items={[]}>` with the empty array hard-coded; the
timeline takes `items` as a prop and never fetched; no host supplied any
(`buildDefaultPageSchema` emits `{ type: 'record:activity' }` with no props at
all). Declared, published to `sdui.manifest.json`, inert at runtime —
objectstack#4413's shape, three blocks over.

**The feed now has three sources, in precedence order.** `items` on the node
(the convention `record:history` uses for `entries`); a mounted
`DiscussionContext`, which the console's record page fills with the merged
`sys_comment` + `sys_activity` feed and the write handlers; otherwise a
**self-fetch** of `sys_activity` scoped to the bound record
(`{ object_name, record_id }`, newest first, `limit` rows per page, "Load more"
re-reading a wider window). The third path is what makes the block
drop-anywhere — hand-authored inside a `page:tabs`, with no host feeding it —
and it mirrors the read `record:history` already had. Rows map to feed items
exactly as the console's record page maps them, so both surfaces agree about
what a row is.

**The read-side inputs now filter.** `types` is an allow-list over feed item
types (unrecognised entries ignored; an all-typo list is treated as unset
rather than emptying the feed). `limit` is a page size and caps the scoped
read. `showCompleted` (spec default `false`) hides completed activities.
`unifiedTimeline: false` un-mixes field changes from the comment stream — the
panel becomes a discussion feed and field changes stay in `record:history`.
`filterMode` seeds which slice the dropdown opens on and falls back to `all`
on an unrecognised value instead of leaving a `<Select>` matching nothing.

**The write-side switches are wired to the host's handlers.**
`showCommentInput`, `enableThreading`, `enableReactions` and `enableMentions`
read `onAddComment` / `onAddReply` / `onToggleReaction` /
`mentionSuggestions` off `DiscussionContext` — the same standing
`record:discussion` has. With no host mounted the feed stays read-only and no
composer is rendered, rather than showing one that silently drops what you
type.

**`showSubscriptionToggle` is recorded as a known gap, not quietly left
looking configurable.** The bell needs a `RecordSubscription` value and
somewhere to persist it, and the platform has no record-subscription object to
read or write one from. Its input description now says `NOT IMPLEMENTED` (that
text ships to `sdui.manifest.json`, so an author meets it before writing the
prop), the docs repeat it, and a test pins it inert so the note has to be
deleted the day a backend for it lands.

`apps/console`'s record-reach probe (objectui#3149 layer 3a) asserted the old
behaviour from its `NO_RECORD_REACH` ledger in both directions; that entry is
deleted, and the probe now reports `record:activity` as responding to the bound
record.
