---
'@object-ui/types': minor
---

Retire `ComponentInput`'s four inert constraint keys — `min`, `max`, `step` and
`placeholder` (objectui#5905, ADR-0049 enforce-or-remove).

All four were declared on `ComponentInput` and read by nothing, on either path. No consumer
reads them off a `ComponentInput` value, and the manifest serializer
(`packages/sdui-parser/src/index.ts`) forwards exactly six keys per input — `name`, `type`,
`required`, `enum`, `binding`, `description` — so a value authored here could not reach the
published `sdui.manifest.json` even in principle. Re-measured on this branch's merge-base
rather than inherited from the card: a structural census over every `inputs:` array in the
repository (219 regions, all tracked files) scores `min` **0**, `max` **0**, `step` **0**
and `placeholder` **0**, against `name` 926, `type` 926, `description` 161, `enum` 114 and
`required` 87 in the same pass over the same regions — the instrument was not blind.

FROM → TO, per key:

⚠️ The four are **TOMBSTONED, not removed** — the declaration stays, the key becomes
unwritable. An earlier draft of this list said "removed", which contradicted the paragraph
below it and described the option this change deliberately did NOT take.

- `min: number` → **tombstoned** (`?: never`, named Zod refusal). Spell the numeric domain
  out in `description`, which IS published (`'A positive integer — the contract rejects 0
  and fractional values'`).
- `max: number` → **tombstoned**. Same remedy.
- `step: number` → **tombstoned**. Same remedy.
- `placeholder: string` → **tombstoned**. Put the hint in `description`. ⚠️
  `BaseSchema.placeholder` — the node-level prop a renderer does read — is a DIFFERENT key
  and is unaffected.

The retirement kit: `?: never` on the interface (`packages/types/src/base.ts`), so authoring
one is a `tsc` error at the registration site; `retirementTombstone()` on the Zod mirror
(`packages/types/src/zod/base.zod.ts`), so an authored value is REFUSED at parse time with
`code: 'invalid_type'`, the key named in the issue `path`, and the migration note as the
message. Deleting the members outright was the option NOT taken: `ComponentInputSchema` is
a non-strict `z.object`, which strips an undeclared key silently — one silent no-op traded
for another. Pinned in
`packages/types/src/__tests__/component-input-retired-constraint-keys.test.ts`.

Two limits worth stating rather than papering over:

- The in-repo zero is what was measured. Whether anything OUTSIDE this repository writes
  these keys is **not measurable from here** (the same limit objectui#5674 recorded for
  `PluginComponentInput`). Converting such a write from a silent drop into a named refusal
  is exactly what the tombstone buys.
- The fifth key objectui#5905 named, `inputType`, is **NOT retired here**.
  `packages/plugin-markdown` authors it (`inputType: 'textarea'`), so it is
  declared-and-DROPPED — a different defect that needs a ruling, not a removal. That
  ruling landed on 2026-08-31 and `inputType` is tombstoned in the follow-up change; this
  note records the state as of THIS change, which is what a changeset is for.

This is not a verdict that constraint slots on `ComponentInput` were a mistake. The
neighbouring `type` field carries a maintainer ruling of 2026-08-17 recording that giving
`ComponentInput` real constraint slots was **deferred, not rejected** — `min`/`max`/`step`
read exactly like the slots that ruling declined to add. What is retired is this inert
spelling; the ruling's own reopen condition still stands.
