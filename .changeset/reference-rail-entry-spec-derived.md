---
"@object-ui/plugin-detail": minor
---

**`ReferenceRailEntry` is now the spec's type, and the reference-rail `icon` key retires** (objectui#5494, maintainer ruling 2026-08-22).

`ReferenceRailEntry` is owned by `@objectstack/spec` as of 17.1.0. The hand-written interface in `record-reference-rail.tsx` is replaced by a re-export of the spec's `ReferenceRailEntry` (derived from `ReferenceRailEntrySchema`, `$strict` over `{ objectName, relationshipField, title?, limit?, displayField? }`), and `buildDefaultPageSchema` no longer emits `icon` on the reference-rail entries it synthesizes.

**Migration — if you write `icon` on `record:reference_rail` entries, remove it.** Be aware of what this does and does not change:

- **Runtime validation does not move.** The spec's strict schema already refused `icon` at save — that refusal is unchanged. What was broken was objectui's declaration: the TS type advertised a key that could never be saved.
- **Nothing ever rendered `icon`.** No render path in `RecordReferenceRailRenderer` has ever read the key (measured back to the file's first commit, and independently by the spec's `ui-reference-rail-unknown-keys-refused` migration entry). An authored `icon` that survived in unsaved/preview metadata was already a silent no-op — after this change the TS type says so instead of suggesting otherwise.
- **The published TS surface narrows.** Code that imported `ReferenceRailEntry` from `@object-ui/plugin-detail` internals and set `icon` will now get a type error. That error is the contract speaking: remove the key.

The reference-rail icon affordance is retired rather than proposed upstream: a stock scan of this repo, its examples and schema-catalog corpus, and the objectstack tree (examples, templates, docs) found no reachable authored usage of `icon` on reference-rail entries. Stored customer metadata is not reachable from this seat and was not scanned.
