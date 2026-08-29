---
'@object-ui/plugin-chatbot': minor
---

`surface` becomes authorable on the `chatbot-enhanced` node, so the capability the docs
have been documenting is one an author can actually reach (objectui#6687, maintainer
ruling 2026-08-29).

`content/docs/plugins/plugin-chatbot.mdx`'s `Properties` table listed `surface`
(`'card' | 'plain'`, "bordered panel or a frameless full-page workspace"), but the key had
**zero read points**: none of the three `ComponentRegistry.register('chatbot*', ...)` sites
in `renderer.tsx` forwarded it, and `ChatbotSchema` did not declare it. `surface` was real
only as a prop of the React component — `ChatbotEnhanced.tsx` defines `ChatbotSurface`,
defaults it to `'card'`, and branches six layout decisions off `isPlainSurface` — so it was
reachable by a hand-written React host and by nobody writing metadata. An author who wrote
`surface: 'plain'` got the `'card'` default, with no error and no signal.

Measured on both declaration faces before the fix, each with a control that had to hit:
`schema.surface` appeared 0 times in `renderer.tsx` against `schema.placeholder` at 3 (one
per registration) and `schema.processVisibility` at 1; and `ChatbotSchema`
(`packages/types/src/complex.ts`) declared 34 keys, not this one. Two faces agreeing is
what made the zero a reading rather than a bad query.

The ruling adopted **wiring it** over deleting the row — the row names a real, shipped
capability, and hiding it back inside the component would withdraw it from authors. It also
matches this page's two existing resolutions of the same defect class, neither of which
deleted a row: `requestBody` (objectui#6193) kept its row and documented the seam, and
`maxToolRoundtrips` (objectui#5605) kept its row, marked it inert, and warns once at runtime.

- `chatbot-enhanced` declares `surface?: ChatbotSurface` on its inline schema-extension
  type and forwards `schema.surface` to `<ChatbotEnhanced>`. The union is **imported** from
  `ChatbotEnhanced.tsx` rather than re-spelled, so there is one contract rather than two
  dialects that can drift (AGENTS.md #0.1).
- The key joins the registration's `inputs` (designer + autocomplete surface) with
  `defaultValue: 'card'`, and deliberately **not** its `defaultProps` — mirroring
  `processVisibility`, so nothing materializes the key onto new nodes.
- **The absent case is unchanged**: an unauthored `surface` is forwarded as `undefined`, so
  `<ChatbotEnhanced>`'s own `surface = 'card'` default still applies. This is pinned as
  hard as the authored direction, because it is what a careless
  `schema.surface ?? 'plain'` or a `defaultProps` entry would silently regress for every
  existing document.
- `chatbot` and `chatbot-floating` do **not** gain the key: they render `<Chatbot>` and
  `<FloatingChatbot>`, which have no such chrome to switch. The docs row is therefore
  scoped to say the key applies to the enhanced registration — the table never again claims
  more than the registrations deliver.

`renderer.surface.test.tsx` pins all of it through the real SDUI host rather than a bare
component render, and asserts the rendered chrome rather than the forwarded prop, so a
regression where the key is forwarded but no longer acted on is still red.
