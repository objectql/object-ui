---
---

Comment-only fix in `packages/cli/src/commands/check.ts`: the note beside the
structural marker gate promised that "the corpus migration repays" the recall
debt — the real schema files the checker skips because their root carries no
structural key. No such migration exists and none can be written. The marker it
would stamp is the `$schema` URL the 2026-08-20 ruling declined to mint, and
`OBJECTUI_SCHEMA_URL` / `pointsAtObjectUi()` were deleted before objectui#5334
merged. The same file already states, twenty lines earlier, that there is
deliberately no `$schema` arm and no URL to declare — so the file contradicted
itself.

The note now says what is true: the recall debt is real and unpaid, the
`$schema` route was ruled against, a corpus-wide `$schema` sweep is a measured
no-op on the skipped-file count, and the arm can be added later without
invalidating a single file because matching would be host-based. It points the
next reader at the tracking card and its blocker instead of at a dead route.

No behaviour change and nothing to release — `objectui check` judges, skips and
prints exactly what it did before.
