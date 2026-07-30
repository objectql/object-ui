---
"@object-ui/console": patch
---

test(sdui): check the contract in the direction that would have caught #3006

The console contract guard only looked one way: every tag in `PUBLIC_BLOCKS`
must resolve. That direction cannot tell "not built yet" from "built, but the
contract spells it wrong" — so `record:line_items` was filed as a known gap for
a release while its renderer shipped, fully configured, in plugin-form.

Two checks close the other direction:

- **Every shipped `record:*` block is curated, or listed with a reason.** Seven
  are deliberately out, each declaring zero `inputs` — nothing for an author or
  a model to configure. A new `record:*` registration now fails until someone
  decides which side it belongs on, so the vocabulary cannot quietly drift from
  what the platform can render. A companion assertion pins those seven at zero
  inputs, so one growing a configurable surface re-opens the decision instead of
  inheriting the exclusion.

- **A curated tag that near-misses a registered block.** `line_items` vs
  `record:line_items` differ only by namespace; one of the two spellings is
  always a typo. The check reports the candidate ("also try
  `record:line_items`") rather than just "not covered".

Both were verified against the real bug: reverting the tag to `line_items`
fails them with exactly that diagnosis.

Grouping the registry by canonical `type` surfaced a second, latent issue —
eleven `record:*` blocks in plugin-detail are registered as
`register('record:x', …, { namespace: 'record' })`, prefixing an already-
prefixed name and yielding doubled `record:record:x` keys. It does not reach
the contract (`getPublicConfigs()` rewrites `type` to the curated tag), so this
changeset only documents it where the grouping happens; the registrations are
left for a separate change.
