---
---

Comment-only: `record-title.ts` gave one precedence rung two different numbers. The
`NAME_ISH_RECORD_KEYS` probe gated by `RecordDisplayNameOptions.deriveFromRecordKeys` was
labelled `3b` in that option's docblock and `4b` in the `getRecordDisplayName` docblock and
on the branch itself. Both ladders in the file number the type-aware derivation from
`objectDef.fields` as step `4` and `objectDef.titleFormat` — a rendered template, not a
record-key probe — as step `3`, so `4b` is the number the file supports and `3b` was the
leftover. Nothing mechanical noticed, and other files cite these numbers by hand.

No published behaviour changes: `deriveFromRecordKeys` is untouched and the numbers exist
only in comment text. A source-reading pin
(`record-title.stepNumbering.test.ts`) now checks the file's sub-step labels against the
file's own ladder, so a label that disagrees with the rung it sits under fails.
