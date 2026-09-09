---
---

Documentation only — no published behaviour changes, and no version bump is declared.

objectui#7685 recorded, in both metadata writers' docblocks and in the pending
`7714-lookup-draft-stays-client-side` changeset, that refusing a whitespace-only
`reference` on `lookup` / `master_detail` was a **declared divergence**: stricter
than `@objectstack/spec`, which spelled its emptiness test as an equality against
`''` and so accepted `reference: '   '`.

objectstack#16920 (merged 2026-09-08) applies that test to the trimmed value, so
the spec refuses the identical shape under the same `custom` issue at the same
`reference` path. The guard is therefore contract-following, and only the note
was stale. The notes are rewritten; **the guard itself is byte-identical**
(`assertRelationshipTargetPresent` and `describeUnusableTarget` in both
`@object-ui/app-shell`'s `MetadataService` and `@object-ui/plugin-designer`'s
`MetadataFieldsPage` hash the same before and after), because it still earns its
place: it refuses at EDITOR time, before the PUT, where the author is told which
field is wrong while it is on screen — the contract refuses at the publish gate,
as a 422 on the whole object document with the half-filled draft riding along.

⚠️ Measured, not assumed: this repo's pin is `@objectstack/spec` 17.3.0, which
predates objectstack#16920 (an unreleased `minor` upstream). At that pin `'   '`
still parses green at field level and through `ObjectSchema` — controls at the
same pin refuse absent and `''` as `custom` at `reference` and accept
`'account'`. So the docblocks say the guard matches the spec **from the release
carrying objectstack#16920**, not "the installed spec", and the pins keep
asserting the writer's refusal separately from the spec's verdict — the spec-half
assertion is now labelled a tripwire that reddens on the pin bump. ⛔ Bumping the
pin is a separate card.
