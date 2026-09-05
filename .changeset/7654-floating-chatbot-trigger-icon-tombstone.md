---
'@object-ui/types': minor
---

Retire `FloatingChatbotConfig.triggerIcon` (objectui#7654, ADR-0049 enforce-or-remove).

`triggerIcon` was declared `?: string` with `@default 'MessageCircle'` and read by nothing.
`FloatingChatbot` destructures six of the interface's seven keys — `position`,
`defaultOpen`, `panelWidth`, `panelHeight`, `title`, `triggerSize` — and never this one,
and `FloatingChatbotTrigger` takes no icon prop at all, so the advertised default never
rendered either. Re-measured on this branch's base rather than inherited from the card: a
whole-repo `git grep` census over tracked files, build output excluded, returns the
declaration and one historical CHANGELOG line and nothing else, while the same pass over
`triggerSize` — a key that IS read — returns ten sites across four files, so the instrument
was not blind.

It is also absent from the `chatbot-floating` registration's `inputs` AND from its
`defaultProps` (`packages/plugin-chatbot/src/renderer.tsx`), both re-confirmed here. No
designer control ever offered it and no designer-created node carries it, so TypeScript was
the only way to reach the key. That is what makes this half of objectui#7654 an ordinary
retirement; the card's other key, `displayMode`, is seeded into `defaultProps` and is NOT
touched here.

FROM → TO: `triggerIcon?: string` → **tombstoned**, `?: never` on the interface. The FAB
trigger renders a fixed icon and takes no icon prop; there is no authored spelling that
changes it.

## This tombstone has NO Zod half, deliberately

Every other tombstone in this package pairs `?: never` with a `retirementTombstone()`
refusal on the Zod twin. There is no twin here to carry one: `FloatingChatbotConfig` has no
Zod mirror at all, and `floatingConfig` sits in the `UnmirroredDeclared` ledger
(`zod-mirror-parity.test.ts`, `complex.zod.ts#ChatbotSchema`). `BaseSchema` is
`.passthrough()`, so the whole `floatingConfig` object rides through unvalidated — before
this change and after it. Minting a mirror to host a refusal would be the
declared-but-UNMIRRORED axis (objectui#6152), a different defect: a key can be mirrored and
inert, or unmirrored and live, and fixing one says nothing about the other. This change
does not widen into it.

**Accept-set change, stated plainly for reviewers:** on the TypeScript face, a write of
`FloatingChatbotConfig.triggerIcon` used to compile and now does not. On the runtime face,
nothing changes at all — the key parsed green before and parses green after. The refusal is
TYPE-LEVEL ONLY, which is narrower than this package's other tombstones and is the reason
this carries a contract-review label rather than being filed as an internal tidy-up.

## Why a tombstone and not a deletion, when the usual argument does not apply

The usual case for `?: never` argues from the mirror: an undeclared key is silently
STRIPPED by a non-strict `z.object`, so deleting trades one silent no-op for another. With
no mirror, that argument is unavailable, so the route was measured on the `tsc` channel
alone instead:

| route | fresh object literal | widened (non-fresh) value |
|---|---|---|
| deleted | `TS2353` excess-property error | **compiles CLEAN** |
| tombstoned | `TS2322` | `TS2322` |

Excess-property checking only reaches a fresh literal, so deletion would have left the
widened path — `const raw = { triggerIcon: 'Sparkles' }; const cfg: FloatingChatbotConfig =
raw;` — silently accepting a key nothing reads. The declared `never` makes the assignment
itself ill-typed, so freshness stops mattering. Both rows are pinned in
`packages/types/src/__tests__/floating-chatbot-trigger-icon-retired.test.ts`, the "deleted"
row as a live control on a genuinely undeclared key rather than as prose, so the contrast
cannot rot.

That file also pins the runtime half as a **tripwire**: it asserts that a node carrying
`floatingConfig.triggerIcon` still parses green. If objectui#6152 ever mints a
`FloatingChatbotConfigSchema`, it goes red — the intended signal that whoever lands the
mirror must add the `retirementTombstone()` half at the same time and flip the control
rather than delete it into a vacuum.
