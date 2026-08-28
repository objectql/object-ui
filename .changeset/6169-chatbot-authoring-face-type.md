---
'@object-ui/types': minor
'@object-ui/plugin-chatbot': minor
---

`ChatbotSchema` names the `chatbot` node's local-display and legacy
auto-response keys — a new, additive published surface (objectui#6169, the
#6172 family ruling: every component node has exactly one named, importable
authoring-face type).

`ChatbotSchema` (`@object-ui/types`) now declares ten keys that previously
existed ONLY inside an anonymous inline intersection local to
`packages/plugin-chatbot/src/renderer.tsx`'s `chatbot` registration, invisible
to anything outside that one file:

- `showTimestamp`, `userAvatarUrl`, `userAvatarFallback`, `assistantAvatarUrl`,
  `assistantAvatarFallback`, `maxHeight` — display fields.
- `autoResponse`, `autoResponseText`, `autoResponseDelay` — the local
  auto-response (demo/playground) fields, already live via a real consumer
  (`packages/app-shell/src/console/ai/AiChatPage.tsx`).
- `onSend?: (content: string, messages: ChatMessage[]) => void` — the
  send-callback, now typed against the published `ChatMessage` shape rather
  than the plugin's internal runtime message type.

Each was read-site-censused before being declared (renderer.tsx and/or
`useObjectChat.ts` reads every one); none were dead, so none took the
ADR-0049 retirement route. `disabled` — also present in the original
intersection — is NOT redeclared: it is already `BaseSchema.disabled`
(`boolean | string`), read generically for every node type, and redeclaring
it here would have narrowed away the inherited expression-string case.

**What an external consumer can now do that they could not before:** import
`ChatbotSchema` from `@object-ui/types` and get these ten keys with real,
checked types — previously any reference to them required either duplicating
the anonymous type by hand or falling back to `any`. The Zod mirror
(`@object-ui/types/zod`) gained the same ten keys in lockstep, so a `chatbot`
node parsed through it is now validated on these keys rather than silently
passed through unchecked (`BaseSchema`'s Zod mirror is `.passthrough()`).

`packages/plugin-chatbot`'s `chatbot` registration (`renderer.tsx`) now types
its `schema` prop as `ChatbotSchema` directly, dropping the anonymous
intersection. No behavior change: `renderer.tsx:87`'s
`body: schema.requestBody` forwarding — the subject of the already-merged
#6193 — is untouched, and the render function reads the exact same keys it
already read.

This is additive (new optional keys on an interface that already carried a
`[key: string]: any` index signature, and a new Zod-validated subset of
previously-passthrough keys), so it ships as `minor` even though it changes
published type surface: objectui's major is pinned to `@objectstack`'s
(`scripts/check-changeset-no-major.mjs`), and objectui's own breaking changes
ship as `minor` with the break spelled out — there is no break here to spell
out, only a widening from anonymous-and-unchecked to named-and-validated.

Out of scope, deliberately: the `chatbot-enhanced` and `chatbot-floating`
registrations' own anonymous intersections (different key sets, a decision
for a separate card in the same family), and the `surface` row on
`content/docs/plugins/plugin-chatbot.mdx`'s Properties table, which names a
key no registration in this package currently reads (filed separately).
