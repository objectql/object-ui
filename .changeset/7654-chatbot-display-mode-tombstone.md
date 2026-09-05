---
'@object-ui/types': minor
'@object-ui/plugin-chatbot': patch
---

Retire `ChatbotSchema.displayMode` — and its copy on `ChatbotFloatingSchema` — as an
ADR-0049 retirement tombstone, and remove the `chatbot-floating` registration's
"Display Mode" designer control and its `defaultProps.displayMode: 'floating'` seed
(objectui#7654, maintainer ruling B of 2026-09-05, director decision batch #44).

⚠️ **BREAKING for anyone authoring `displayMode` against a chatbot face in TypeScript.**
Ships as `minor` per the launch-window convention: objectui's `major` is a cross-repo pin
to `@objectstack`'s so that "same major means compatible" holds across the two repos
(`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes ship as
`minor` with the break named where it lands — this entry is the channel that carries it.

## What was retired, and why

The node `type` — `chatbot-floating` versus `chatbot` / `chatbot-enhanced` — is the one
selector of presentation. `displayMode` (`'inline' | 'floating'`) was a second spelling
of that same choice, and no renderer has ever read it: `chatbot-floating` renders the
trigger and panel unconditionally, and `chatbot` never looked at the key, so
`displayMode: 'floating'` on a `chatbot` node produced no trigger and `'inline'` on a
`chatbot-floating` node changed nothing. It was nevertheless declared on both faces,
painted as a **Display Mode** control in the designer's property panel, and written as
`'floating'` into every node the designer created — two surfaces teaching a switch that
did not exist.

Re-measured on this branch's base rather than inherited from the card: a whole-repo
`git grep` census over tracked files, build output excluded, returned the declarations,
the doc comments and parity-ledger entries beside them, one historical CHANGELOG line and
two unrelated `displayMode` props on `GridField` / `MasterDetailForm` — no read. The same
pass over `floatingConfig`, a key that IS read, returned 79 lines, so the instrument was
not blind.

FROM → TO:

- `ChatbotSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**, an
  ADR-0049 retirement tombstone whose comment points at `type` as the replacement.
- `ChatbotFloatingSchema.displayMode?: 'inline' | 'floating'` → **`displayMode?: never`**,
  the same tombstone. objectui#7655 declared the key on the floating face with
  `ChatbotSchema`'s own lines precisely so this retirement would find it on both faces;
  leaving the copy typed would have kept the published face teaching the switch.
- `chatbot-floating` `inputs`: the **Display Mode** control is removed.
- `chatbot-floating` `defaultProps`: `displayMode: 'floating'` is no longer written into
  designer-created nodes.

A control is restated, never deleted into a vacuum (objectui#7070): the restatement of
the removed control is the tombstone's guidance plus this note.

**Migration.** Delete `displayMode` from any TypeScript literal typed as `ChatbotSchema`
or `ChatbotFloatingSchema`; the presentation you wanted is already chosen by `type` —
`'chatbot-floating'` for the trigger-and-panel, `'chatbot'` / `'chatbot-enhanced'` for
inline. **No JSON document needs editing** — see the next section.

## Stored documents: runtime validation of this key is unchanged — zero before, zero after

`displayMode` has never had a Zod arm — it sits in the `UnmirroredDeclared` ledger for
both `complex.zod.ts#ChatbotSchema` and `#ChatbotFloatingSchema`, and `BaseSchema` is
`.passthrough()` — so a stored document carrying `displayMode: 'floating'` (every node
the designer ever created) parses green before this change and parses green after it,
and the value is dropped at render time exactly as it always was.

That is deliberate, and it is why this tombstone has **no `retirementTombstone()`
half**: minting a mirror arm to refuse the key would be the declared-but-unmirrored axis
(objectui#6152), a different defect, and a parse outcome the ruling did not ask for.
`packages/types/src/__tests__/chatbot-display-mode-retired.test.ts` pins both twins'
shapes as a **tripwire** — the same shape objectui#7669 gave `triggerIcon` — so that if
objectui#6152 ever mints an arm for `displayMode`, the pin goes red and whoever lands the
mirror adds the `retirementTombstone()` half at that time, flipping the control rather
than deleting it.

## Why a tombstone and not a deletion — measured on this carrier

`ChatbotSchema` extends `BaseSchema`, which carries a `[key: string]: any` index
signature, and on such a carrier deleting an optional member is **silent in every value
shape**: the index signature defeats both excess-property checking and the weak-type
check. Measured on this member with `tsc -p tsconfig.test.json`, a no-index-signature
control carrier (`FloatingChatbotConfig`) lit in the same run:

| route | fresh `'floating'` | fresh `'bogus'` | widened `'floating'` |
|---|---|---|---|
| declared (before) | clean | `TS2322` | clean |
| deleted | clean | **clean** | clean |
| tombstoned (after) | `TS2322` | `TS2322` | `TS2322` |

Deleted, the member reads as `any` and even a wrong-typed value goes quiet. Tombstoned,
**presence with any value** is a compile error — a channel deletion cannot produce on
this carrier at all. On a `BaseSchema` carrier the two routes are loud-vs-silent, not
louder-vs-quieter (the discriminator's carrier branch as corrected on objectui#7678).
Prong 2 of that discriminator licenses the tombstone: the key was advertised in the
3.3.0 release record (`CHANGELOG.md:578`) and its published comment taught it as the
presentation switch. The deleted row is pinned in the test file as a live control — an
undeclared key that rides both shapes with no directive — so the contrast cannot rot.

**Accept-set change, stated plainly for reviewers:** on the TypeScript face, a write of
`displayMode` against either chatbot face used to compile and now does not. On the
runtime face nothing changes at all. On the designer face, one control disappears from
the `chatbot-floating` property panel and new nodes no longer carry the key.
