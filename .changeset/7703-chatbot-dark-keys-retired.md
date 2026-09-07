---
'@object-ui/types': minor
---

Retire the six `ChatbotSchema` members no `plugin-chatbot` registration reads —
`loading`, `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown` and `height` — as
ADR-0049 retirement tombstones on **both** published faces (objectui#7703).

⚠️ **BREAKING for anyone authoring one of these six against `ChatbotSchema`, on either
face.** Ships as `minor` per the launch-window convention: objectui's `major` is a
cross-repo pin to `@objectstack`'s so that "same major means compatible" holds across the
two repos (`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes
ship as `minor` with the break named where it lands — this entry is the channel that
carries it.

## What was retired, and why

The published type taught six knobs that did nothing. An author — or an AI author reading
the `.d.ts` — wrote `showAvatars: true` or `height: 400` on a `chatbot` node, got no error
on either face, and saw no change. Two of them advertised a `@default true` for a switch
that did not exist.

Re-measured on this branch's base (`21d7989fb`, i.e. **after** objectui#7708's fence
landed as PR #8077) rather than inherited from the card: one `schema.KEY` count per
`ComponentRegistry.register(...)` body of `packages/plugin-chatbot/src/renderer.tsx`, the
file split at the three register calls.

| key | declared type | `schema.KEY` reads (`chatbot` / `chatbot-enhanced` / `chatbot-floating`) |
| :-- | :-- | :-- |
| `loading` | `boolean` | 0 / 0 / 0 |
| `showAvatars` | `boolean` (`@default true`) | 0 / 0 / 0 |
| `userAvatar` | `string` | 0 / 0 / 0 |
| `assistantAvatar` | `string` | 0 / 0 / 0 |
| `markdown` | `boolean` (`@default true`) | 0 / 0 / 0 |
| `height` | `string \| number` | 0 / 0 / 0 |

Lit controls on the same instrument in the same pass: `placeholder` 1 / 1 / 1, `messages`
1 / 1 / 1, `userAvatarUrl` 1 / 1 / 1, `maxHeight` 1 / 1 / 0, `floatingConfig` 0 / 0 / 1,
`processVisibility` 0 / 1 / 0. The zeros are readings, not a blind grep.

⛔ `processVisibility` is **not** in this retirement — `chatbot-enhanced` reads it, and
objectui#7655 left the `ChatbotSchema` member as it was. It is pinned live as a control.

### `showAvatars` is the one key the FENCE turned dark, not a key nothing ever read

The distinction is recorded rather than smoothed over, because the two provenances are
different facts. `ChatbotEnhanced` really does have a `showAvatars` prop, and until
objectui#7708 the `chatbot-floating` registration ended its panel element with a raw
`{...props}` spread that handed an authored value straight to it — measured live through
the real host. That card was ruled **fence**, not declare, and landed as PR #8077: the
spread is filtered through `toDomProps` and moved ahead of every named prop. So the key is
dark on all three registrations **by ruling**, and this retirement records that, not an
absence. The other five were live on no channel at any time — they are not
`ChatbotEnhancedProps` members either (`markdown` exists there only as `enableMarkdown`),
so the spread had nothing to land them on.

## Enforce-or-remove, decided per key

The other arm was taken key by key and refused each time. `<Chatbot>`
(`plugin-chatbot/src/index.tsx`) — the component the `chatbot` registration renders —
declares `messages`, `placeholder`, `onSendMessage`, `disabled`, `showTimestamp`,
`userAvatarUrl`, `userAvatarFallback`, `assistantAvatarUrl`, `assistantAvatarFallback` and
`maxHeight`, and **not one of the six**.

| key | why not enforce | migration |
| :-- | :-- | :-- |
| `loading` | Chat progress is runtime state the chat runtime owns — the registration derives it from `useObjectChat` as `isLoading`. A static authored boolean would fight the runtime, not configure it | delete the key |
| `showAvatars` | No target on `<Chatbot>`. Declaring it on the two faces that DO reach `<ChatbotEnhanced>` would re-open by declaration the channel objectui#7708 closed by fence, one card earlier | delete the key — a `chatbot` node already renders an avatar beside every message |
| `userAvatar` | A second authorable spelling of an image `userAvatarUrl` already carries (AGENTS.md #0.1: one strict contract, not N dialects) | `userAvatarUrl` (+ `userAvatarFallback`) |
| `assistantAvatar` | Same | `assistantAvatarUrl` (+ `assistantAvatarFallback`) |
| `markdown` | `<Chatbot>` prints message content as text and has no markdown path; on the two nodes that render markdown, `enableMarkdown` is the live key | `type: 'chatbot-enhanced'` with `enableMarkdown` |
| `height` | `<Chatbot>` has no `height` prop, and the live `maxHeight` it forwards is a `string`, not this key's `string \| number` union | `maxHeight`, or `floatingConfig.panelHeight` on a floating node |

## FROM → TO

Each member goes to `?: never` on `packages/types/src/complex.ts` and to
`retirementTombstone(...)` on `packages/types/src/zod/complex.zod.ts` — both halves, in
lockstep, the convention `MarkdownSchema.sanitize` (objectui#6972),
`TimelineSchema.timeScale` (objectui#6355) and `ObjectViewSchema.viewTabBar`
(objectui#7779) already carry. Each refusal names the key, says why it is retired, and
points at what to write instead; one string feeds both the parse-time message and the
`.describe()` metadata, so the two cannot drift.

## Accept-set change, one line per face

- **TypeScript.** A write of any of the six against `ChatbotSchema` used to compile and
  now does not — including through a widened (non-fresh) value, which is the half a
  deletion would have missed on a `BaseSchema` carrier.
- **Runtime (Zod / `safeValidateSchema`).** A `chatbot` document authoring one of the six
  used to parse **green** and now parses **red**, `invalid_type` at the key's own path
  with the guidance as the message. This is the narrowing that carries
  `needs:contract-review`.
- **`chatbot-enhanced` / `chatbot-floating`.** Unchanged in both directions. Those faces
  never declared the six (objectui#7655 censused them out), their twins have no arm to
  refuse one, and `BaseSchema` is `.passthrough()` — so a stored node of either type
  carrying a retired key parses exactly as it did. Pinned.

## Why tombstones and not deletions

All six **have** a Zod arm, and that is what decides the route here. `BaseSchema` is
`.passthrough()` on the Zod side and carries a `[key: string]: any` index signature on the
TS side, so an UNDECLARED key is not refused — it is KEPT. Deleting the members would hand
the authored spelling exactly the silent no-op this card exists to close, on both faces at
once. The two-prong discriminator (`mobile.ts`, objectui#5941 / #7526 / #7678) leaves that
structural hazard to the carrier: where there is no mirror there is "no silent-strip hazard
for prong 2 to guard". Here there is a mirror to host the refusal, and prong 1 holds by the
letter for four of the six. The "deleted" row is pinned live as a control in
`packages/types/src/__tests__/chatbot-dark-keys-retired-7703.test.ts`, so the contrast
cannot rot into prose.

## Docs

`content/docs/plugins/plugin-chatbot.mdx` gains the restatement of the six removed keys
with their replacements (objectui#7070: a control is restated, never deleted into a
vacuum), and its three present-tense claims that the `chatbot-floating` props spread is
still unfiltered are corrected to what PR #8077 actually left behind.
