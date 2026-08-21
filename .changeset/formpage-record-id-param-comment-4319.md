---
---

Comment-only repair in `apps/console`'s `FormPage`: the `FORM_RECORD_ID_PARAM`
docblock no longer borrows `createdRecordPath.ts` as a second witness for
`@object-ui/app-shell`'s root-barrel unreachability. That sibling case was
resolved when the host-app resolver was published from the package root, so a
reader following the cross-reference found the opposite of what it promised.
The surviving justification is unchanged and still true — the root barrel does
not re-export `./urlParams` — and now states that fact directly. No published
behaviour changes.
