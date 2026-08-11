---
'@object-ui/app-shell': patch
---

Home's action centre badges everything that is waiting, not the five rows it has room for

`/home` showed two numbers for one question. The bell badges distinct unread topics plus pending approvals over the shared feed's full 20-row window; the action centre 200px below badged `pendingApprovalsCount + notifications.length` — and `notifications` is the list it renders, which `useHomeInbox` caps at 5. So nine unread messages read as **9** on the bell and **5** on the card, on one page, about one set of rows. The badge was reporting the size of a preview as if it were a total.

Before objectui#4225 the card could not have said anything else: its own read was `$top: 5`, so nine was not a number it had. Both surfaces now cut from one already-joined feed, so the true count is in hand at Home's call site and the cap is a presentation slice over data the card already holds.

`useHomeInbox` grows one additive field, `unreadTopicCount`, and `HomeActionCenter` takes it as a required prop: badge = `pendingApprovalsCount + unreadTopicCount`, list = the same unread set, newest first, still capped at 5. Badge means "how much needs you", list means "the newest few of it" — two semantics, each truthful, one number.

The count is the bell's own fold (`groupNotifications`, by `(topic, title)`) applied to the bell's own rows, deliberately, rather than the pre-slice length of Home's list. That length is title-folded and drops blank titles, so it would agree with the bell on ordinary data and disagree whenever two topics share a title — and "two derivations of one number that agree usually" is exactly the defect objectui#4316 was. One fold, applied twice, cannot drift.

Two adjacent behaviours are unchanged and now pinned as such: the approvals addend (distinct pending request ids from the shared REST feed, degrading to 0 on 404) and the list's own cap of five. "You're all caught up" is now gated on the total rather than on the rows on show, so it can no longer contradict the badge above it.
