---
"@object-ui/console": patch
"@object-ui/app-shell": patch
"@object-ui/i18n": patch
---

fix(console,app-shell): readable reassign hand-off + "System" label for svc:* audit actors — objectstack#4365 / objectstack#4366

- **Approvals inbox** (`ApprovalsInboxPage`): a reassign timeline entry now
  renders "from A to B" from the structured
  `reassign_from`/`reassign_to` fields (and their server-resolved
  `*_name` companions) that objectstack#4365 added to
  `sys_approval_action`, instead of relying on the old default comment that
  baked two raw user ids into user-facing text. Legacy rows without the
  structured fields keep the comment fallback. New i18n key
  `approvalsInbox.reassignFromTo` across all ten locales.
- **Record history** (`RecordDetailView`): an audit row attributed to a
  service principal (`svc:*` on the `actor` column — e.g. a
  `runAs:'system'` flow's `svc:flow:<name>` label from objectstack#4366) now
  renders the localized "System" label instead of the raw principal string;
  the raw value stays on the entry for tooling.
