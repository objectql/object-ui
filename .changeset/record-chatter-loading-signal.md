---
"@object-ui/app-shell": patch
"@object-ui/plugin-detail": patch
---

The record discussion panel now says "loading" while it is loading, instead of
"No comments yet" (objectui#3209).

FROM: opening any record page showed the discussion/chatter panel asserting
`No comments yet` for the whole first leg of the page, then contradicting
itself when the comments appeared. TO: the panel shows the loading row until
the feed has actually answered, and only then commits to "this record has no
comments".

objectui#3205 gave `RecordActivityTimeline` the render branch that prefers a
loading row over the empty copy, and `RecordChatterPanel` already forwarded
`loading` to it in both positions — but on the chatter chain **nothing
produced the signal**, so that branch could never fire. `record:activity`
computes its own flag and was visibly fixed by #3205; chatter was not. The
four wiring points are one chain and are all closed here, because any one of
them left open still ships the empty copy to some user:

- `RecordDetailView` — the host that OWNS the feed fetch — now derives a
  `feedLoading` flag from its two reads (`sys_comment` + `sys_activity`);
- `<DiscussionContextProvider loading={feedLoading}>` publishes it (the field
  was already declared on `DiscussionContextValue`, and already read by
  `record:activity`);
- the auto-appended `<RecordChatterPanel loading={feedLoading}>` — the panel
  authored pages get when they place no discussion slot — receives it
  directly;
- the `record:chatter` / `record:discussion` renderer forwards
  `loading={discussion?.loading}`, so a hand-placed block is on the same
  chain as the synthesized one.

The two reads run in parallel, so the flag closes over **both**: it clears on
`Promise.allSettled`, and a REJECTED read counts as an answer. A deployment
without the audit plugin 404s `sys_activity` and an object with
`enable.feeds: false` 403s `sys_comment`; neither may pin the panel in a
permanent spinner, which would be a worse bug than the one being fixed. The
flag is keyed by `object:recordId` rather than being a plain boolean, so the
first render of a record already reads as loading (no one-frame flash of the
empty state) and navigating between records cannot show the previous record's
settled answer.

No tolerance was added at the consumer. The timeline still does not guess that
"no items yet and just mounted" means loading — that guess is wrong the moment
a record genuinely has no comments, and the signal belongs to whoever owns the
fetch. Same shape as objectui#3165 / #3205: divergence converges at the
producer.
