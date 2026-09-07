---
'@object-ui/types': minor
---

**Breaking for authored metadata:** the legacy `ActionSchema`'s Phase-2 callback
pair — `onSuccess` / `onFailure`, each carrying an `ActionCallback` object — is
RETIRED, and the `ActionCallback` type and its Zod mirror `ActionCallbackSchema`
(with the inferred `ActionCallbackSchemaType`) are DELETED from `@object-ui/types`
and `@object-ui/types/zod` (objectui#7068; maintainer ruling option 1 of
2026-09-05, immediate, no deprecation window; ADR-0049 enforce-or-remove).

**What an author who wrote the shape sees now.** A `{ type: 'action', … }`
document authoring `onSuccess: { type: 'toast', message: '…' }` (or any
`onFailure` callback) no longer validates: the parse fails loudly on the
`onSuccess` / `onFailure` path (`invalid_type`, expected `never`) with the
explanation and the migration in the message, and the TypeScript members are
`?: never` tombstones so the same document is a `tsc` error at the authoring
site. `import type { ActionCallback } from '@object-ui/types'` and
`import { ActionCallbackSchema } from '@object-ui/types/zod'` fail to resolve.

**What was measured, on this branch's base (`900f8d99`).** `ActionCallback`
(`{ type: 'toast' | 'message' | 'redirect' | 'reload' | 'custom' | 'ajax' |
'dialog', message?, url?, api?, method?, dialog?, handler? }`) was declared in
`crud.ts`, mirrored in `zod/crud.zod.ts`, re-exported by both barrels, and
carried on the legacy `ActionSchema` as `onSuccess?` / `onFailure?`. Producers:
the package's own `phase2-schemas.test.ts` fixture and three `ts` fences in
`content/docs/core/enhanced-actions.mdx` — nothing else (`git grep -l
ActionCallback` over `packages content skills` hit the five `packages/types`
files; positive control `SchemaNodeSchema` hit 22). Runtime readers: none —
`ActionRunner` imports `UIActionSchema`, never this interface, and its own
`ActionDef.onFailure` is a different (runner-native) meaning. It was the THIRD
meaning of one key: objectui#5934 had already retired the runner's callback
meaning of `onSuccess` and converged it on the spec's block.

**Why authored JSON that passed publish is unaffected.** `@objectstack/spec`'s
`ActionSchema` (installed pin 17.2.0) already refused the callback shape at
publish — `invalid_type` at `onSuccess.navigate` plus `unrecognized_keys` on the
`onSuccess` block, and `onFailure` refused as an unrecognized key on the action —
so no published or saved metadata could carry it. Only TypeScript code that
typed a callback against the legacy interface, or JSON validated solely through
`@object-ui/types/zod`, meets the new refusal.

**Where the live meaning lives.** Post-success navigation is the spec's
`onSuccess` block, `{ navigate, openIn }`, declared on `UIActionSchema`
(`ui-action.ts`) and forwarded to the runner (objectui#5934). A success or
failure notice is `successMessage` / `errorMessage` — adjacent keys on the same
legacy `ActionSchema`, NOT retired, and still accepted on both faces.

**Two published faces, one retirement — tombstone on the keys, deletion of the
type.** `BaseSchema` is `.passthrough()` on the mirror and carries an index
signature on the interface, so DELETING the two keys would have ADMITTED an
authored callback unchecked on both faces; they stay declared as `?: never` /
`retirementTombstone()` (the PR #7761 / #7769 shape) and the base-vs-extended
contrast is pinned. The standalone `ActionCallback` / `ActionCallbackSchema` have
no such escape hatch and are deleted outright, the route objectui#7664 / PR #7743
took for the `DeclarativeKanban*` trio; the parity ledger drops the pair
(`EXPECTED_MIRROR_PAIRS` 159 → 158) and the absence is pinned in
`action-callback-retired-7068.test.ts`.

**Docs, same change.** `content/docs/core/enhanced-actions.mdx` — the three
`onSuccess` / `onFailure` fences author `successMessage` / `errorMessage`
instead, and the "Callbacks" section is a "Post-success behaviour" note pointing
at the spec block (no fence: the legacy type carries no spec-derived block).
`content/docs/guide/schema-overview.md` — the fragment line, the feature bullet
and the checklist row are rewritten to the truth (the ✅ claim is now a
retirement note).

**Migration:** delete `onSuccess` / `onFailure` from any legacy `ActionSchema`
document or fixture; write `successMessage` / `errorMessage` for notices, put
follow-up work in `chain`, and author post-success navigation as the spec's
`onSuccess: { navigate, openIn }` block on `UIActionSchema`.

Graded `minor`, not `patch`: this narrows the accepted input set on both faces
and removes two exports, which is breaking for any consumer who wrote the shape.
It is not `major` per this repo's fixed-group convention (objectui's own breaking
changes ship as `minor`; the group's major tracks `@objectstack` — AGENTS.md
版本号策略, mechanically enforced by `scripts/check-changeset-no-major.mjs`).
