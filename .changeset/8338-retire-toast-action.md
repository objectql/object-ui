---
'@object-ui/types': minor
---

**Breaking for already-authored metadata:** `ToastSchema.action` is RETIRED on both
published faces (objectui#8338, ADR-0049 enforce-or-remove).

**What was wrong.** The two faces shared nothing, and one of them had no JSON
inhabitant at all. `packages/types/src/feedback.ts` declared
`action?: { label: string; onClick: () => void }` — both members REQUIRED and
`onClick` a function, so a JSON document could omit the key but never author it —
while `packages/types/src/zod/feedback.zod.ts` declared
`z.union([SchemaNodeSchema, z.array(SchemaNodeSchema)])`, a node or a list of nodes.
Disjoint accept sets, one of them empty: the same document got a green `safeParse`
and a `tsc` refusal, and no spelling satisfied both. `renderers/feedback/toast.tsx`
read NEITHER — it reads `variant`, `title`, `description`, `duration`,
`buttonVariant`, `className` and `buttonLabel`, and the file has exactly one
`ComponentRegistry.register` call, so the zero is a reading and not a failed scan.

This is objectui#6496's Direction 2, the half its `completed` close left behind:
that card measured the key, prescribed enforce-or-remove, and was closed by PR #6542,
which is Direction 1 only (declaring `buttonLabel` / `buttonVariant`). The sibling
`onDismiss` was finished separately under objectui#6124 and sits four lines down as
an ADR-0049 tombstone whose prose gives, word for word, the reason `action` should
have gone with it. `action` survived only because that sweep was over TOP-LEVEL
function-valued keys and this key's function is one level down.

**The accept set moves in one direction only — on the MIRROR.** Measured by ablating
the tombstone back to the base tree's two declarations (`3bc187b7f`) and re-running
the pins, then restoring and proving both files byte-identical to `HEAD`:

| `{ "type": "toast", "action": … }` | before | after |
| --- | --- | --- |
| `{ "type": "button", "label": "Undo" }` — a node | **accepted** | refused, `invalid_type` at `action` |
| `[{ "type": "button" }]` — a list of nodes | **accepted** | refused, `invalid_type` at `action` |
| `{ "label": "Undo", "onClick": … }` — the TS face's own shape | refused, `invalid_union` at `action` | refused, `invalid_type` at `action` |
| the key omitted | accepted | accepted |

Nothing went from refused to accepted. The key stays DECLARED rather than deleted,
because `BaseSchema` is `.passthrough()`: removing the member would KEEP an authored
value unvalidated and silently inert instead of refusing it. `retirementTombstone()`
writes ONE guidance string into BOTH author-facing channels — the parse-time issue
message and `.describe()` — so they cannot drift.

**The compile-time face, which a TypeScript author meets first.** A `.tsx` author
COULD write `action: { label, onClick }` against the old declaration and it compiled;
it is now `action?: never`, so the same literal fails type-check. That is the only
place this narrowing removes something that ever worked, and it worked only in the
programmatic channel — no JSON document could ever hold it, and no renderer read it.

**Not `handlerKeyRefusal()`.** `action` is ⛔ not a handler key: it is a VALUE key
whose NESTED member was a function. So it takes the ADR-0049 retirement helper
(`invalid_type`, and `?: never` on the declaration) and not objectui#6124's
named-refusal arm (`custom`, with a TS twin that stays callable for a runtime slot).
The two helpers are pinned apart in `handler-keys-json-refusal-6124.test.ts`, whose
census counts 45 runtime slots + 22 retired `on*` sites — a non-handler key has no
seat in it.

**Migration: there is NONE, and the capability was never fulfilled.** ⛔ Not "not yet
supported" and ⛔ not a pointer at a future shape. objectui#6250's close moved the
seven toast demos off an in-toast action entirely; an in-toast action button remains
a capability expansion with zero runtime and would need its own card. Raise the toast
from the node itself (`title`, `description`, `variant`, `duration`) and label its
trigger with `buttonLabel` / `buttonVariant`. Measured across this repository: of the
7 authored `toast` nodes in tracked JSON, **0** carry `action` (control: the same walk
finds all 7 nodes), and no `.tsx`, `.mdx` or `.ts` source authors one either.

**⛔ `EmptySchema.action` is untouched** (objectui#7105 / PR #8330) — the same word on
a sibling schema in the same file, with the deliberately opposite disposition, and its
own comment block explains that it refuses the `{ label, onClick }` shape this key
spelled. Two different interfaces, on purpose.

**The parity ledgers drain with it,** every figure re-derived by
`zod-mirror-parity.test.ts`'s own AST and mirror instruments rather than stepped by
hand: `KnownDrift` 42 entries / 64 keys → **41 / 63** (the entry's whole content, so
the entry went too — the ledger's first loss by RETIRING a key rather than by moving
either face toward the other), and `WiderThanDeclared` 23 / 36 / 47 arms, split
6 / 30 / 0 / 11 → **22 / 35 / 45**, split **6 / 29 / 0 / 10**. The pair itself stays
registered, so `EXPECTED_MIRROR_PAIRS` does not move.

Graded `minor`, not `patch`: a published accept set narrows. Not `major` per this
repo's fixed-group convention — objectui's own breaking changes ship as `minor` and
the group's major tracks `@objectstack` (AGENTS.md 版本号策略, enforced by
`scripts/check-changeset-no-major.mjs`).
