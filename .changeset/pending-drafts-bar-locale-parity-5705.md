---
'@object-ui/i18n': patch
---

`console.ai.pendingDrafts` — the standing unpublished-changes bar's five strings —
now exists in all ten locale packs. It previously existed only in `en` and `zh`, so
`ar`, `ru`, `pt`, `es`, `fr`, `de`, `ko` and `ja` rendered the English defaults and
`all-locales-key-parity` failed on `main` (objectui#5705).

The feature landed `en`-only in objectui#5696; the follow-up in objectui#5697 was
titled for the locale packs but reached only `zh`, so eight packs × five keys stayed
missing and the parity assertion — which carries no allowlist — was red on `main` and
on every PR whose diff touched source. Source-free diffs skip the shard that runs it,
which is why the breakage survived several merges.

Each pack keeps its own conventions rather than `en`'s: the eight all quote with `"`,
`ru` puts the number last (`…: {{count}}`) as it already does for the sibling
`home.pendingDrafts` counts, and `ja` uses the full-width `：` before `{{detail}}`
because that value is a runtime message rather than a single token — both choices
carry an in-pack note. Terminology is taken from each pack's existing publish-bar
vocabulary (`home.pendingDrafts`, `console.ai.seedWarn`) so the two banners read
alike.

Both interpolations survive verbatim in every pack — `{{count}}` in `count` and
`{{detail}}` in `publishedWithFindings` — asserted mechanically against the evaluated
packs, not by eye. The unrelated `home.pendingDrafts` block (`message` / `cta`) is a
different node and is untouched.
