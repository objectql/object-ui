---
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

The inbox popover now spells out what the bell badge is made of

The bell badge is `unread notification topics + pending approvals`, clamped to
"9+" above nine. As one number it is unexplainable: objectstack#7213 measured
Home's "pending approvals" card saying 8 while the bell said "9+", and read that
as the two counts disagreeing — they never did, the bell was simply carrying a
second addend the user could not see.

The popover already tabs the two streams and puts a count pill on each tab, so
the split was partly visible — but those pills clamp at "9+" too. A loaded
console therefore showed three "9+"s that reconcile to nothing, which is why
sectioning alone did not close this.

A breakdown line under the popover header now states the exact, unclamped
addends beside the exact total — `15 total · 12 notifications + 3 pending
approvals`. The approvals half is the same `pendingApprovalsCount` the Home card
and the Approvals Inbox tab read, so the number a user reconciles against is
literally the one they see elsewhere.

The badge formula, the counting APIs and the "9+" clamp on the badge itself are
unchanged — this is a display fix. Three new keys
(`notifications.badgeTotal` / `badgeNotifications` / `badgeApprovals`) land in
all ten locale packs. They interpolate named placeholders (`{{total}}`,
`{{unread}}`, `{{approvals}}`) rather than i18next's `{{count}}`, which would
additionally drive plural-key resolution these packs carry no forms for.
