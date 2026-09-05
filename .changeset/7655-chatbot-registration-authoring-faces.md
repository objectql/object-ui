---
'@object-ui/types': minor
'@object-ui/plugin-chatbot': patch
---

One named, importable authoring-face type per `plugin-chatbot` registration:
`ChatbotEnhancedSchema` and `ChatbotFloatingSchema` join `ChatbotSchema`
(objectui#7655, under the objectui#6169 / #6172 family ruling — every component
node has exactly one named, importable authoring-face type).

`packages/plugin-chatbot` registers three components — `chatbot`,
`chatbot-enhanced`, `chatbot-floating` — and `@object-ui/types` published ONE
face for the family with `type` pinned to `'chatbot'`. An author annotating a
`chatbot-enhanced` or `chatbot-floating` node either dropped to untyped JSON or
annotated with `ChatbotSchema` and lied about `type`; the docs' floating example
had to be a `json` fence because no `tsx` fence could compile. The two
registrations' real key sets lived in anonymous `ChatbotSchema & { ... }`
intersections local to the renderer, referenceable by nothing outside that file.

## The shape, and why not the smaller diff

One interface per registration, not `ChatbotSchema['type']` widened to the union
of the three keys. The union would give three nodes ONE type and re-open what
#6169 closed — a single interface declaring keys only some of its own `type`
values read — and this card exists because the family's declarations had already
drifted from its reads. Each face declares what ITS registration reads, censused
per key on the PR's base (one `schema.KEY` read per registration body in
`renderer.tsx`, lit by keys that are NOT shared: `processVisibility` 0 / 1 / 0,
`floatingConfig` 0 / 0 / 1), and the twenty keys all three read are picked off
`ChatbotSchema` by name (`ChatbotSharedKey`) so they stay one declaration:

- **`ChatbotEnhancedSchema`** (`type: 'chatbot-enhanced'`): the shared twenty,
  plus `maxHeight` and `processVisibility` (read here, not by the floating
  panel), plus `enableMarkdown`, `enableFileUpload`, `surface` (`'card' |
  'plain'`, objectui#6687) and the `onClear` runtime slot — four keys
  `ChatbotSchema` never declared.
- **`ChatbotFloatingSchema`** (`type: 'chatbot-floating'`): the shared twenty,
  plus `enableMarkdown`, `enableFileUpload`, `onClear`, and the two keys it
  declares alongside `ChatbotSchema` — `floatingConfig` (`FloatingChatbotConfig`)
  and `displayMode`. No `maxHeight`, `processVisibility` or `surface`: the
  floating registration has no named read for any of them. (Its trailing raw
  props spread does carry authored keys into the panel today — `processVisibility`,
  `surface` and `showAvatars` are live there, measured through the real host;
  that accidental channel is tracked as objectui#7708, and this face neither
  declares nor promises it.)
- Neither face declares `ChatbotSchema`'s six legacy members (`loading`,
  `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown`, `height`) — no
  registration reads them by name — and neither redeclares `disabled`, which
  stays `BaseSchema`'s `boolean | string` (objectui#7087).

**`ChatbotSchema` is unchanged.** It keeps `displayMode` and `floatingConfig`
(declarations verbatim), and the floating face declares the same two, so
`ChatbotSchema['displayMode']` and `ChatbotSchema['floatingConfig']` stay the
typed members they were — the objectui#7669 `triggerIcon` tombstone keeps its
reach on `chatbot` nodes, now pinned on the node. `floatingConfig`'s doc comment
is rewritten on both faces: the old text said it was "only used when
`displayMode` is `'floating'`", which was false — it is read by `chatbot-floating`
alone and forwarded to the panel. `displayMode` is RULED RETIRED — objectui#7654,
maintainer ruling B (2026-09-05): `?: never` tombstone, designer control and
`defaultProps` seed removed, in that card's own change. This change carries the
key untouched on both faces (still unmirrored, still read by nothing) so that PR
finds the member exactly as ruled, and a tripwire test pins that any value still
parses green until that PR flips it.

**New published symbol:** `ChatbotSharedKey`, the string-literal union of the
twenty keys all three registrations read. It is exported from `complex.ts`
because an exported interface may not extend a `Pick` over a private name
(TS4022), so it is emitted into `dist/complex.d.ts` and is reachable through the
published `@object-ui/types/complex` subpath (it is not re-exported from the
package entry). It is a census, not an authoring face.

## Zod twins, in lockstep

`@object-ui/types/zod` gains `ChatbotEnhancedSchema` and `ChatbotFloatingSchema`
(and `ComplexSchema` routes the two new discriminants). Every declared key is an
arm except: the three runtime slots (`onError`, `onSend`, `onClear`), refused by
name per objectui#6124; and, on the floating twin only, `floatingConfig` (no
`FloatingChatbotConfig` mirror exists — minting one is objectui#6152's axis) and
`displayMode` (unmirrored on `ChatbotSchema`'s twin too; retired by ruling on
objectui#7654 and executed there). The twins mirror the API body params under the
key the renderer reads, `requestBody`, and inherit `body` as the children slot —
they do not copy `ChatbotSchema`'s `body` naming collision.

**Accept-set change, stated plainly:** a `chatbot-enhanced` or `chatbot-floating`
document parsed through the family's only twin used to fail on `type`; through
its own twin it now parses, and the keys the twin declares are VALIDATED where
they rode through `.passthrough()` unexamined before (`surface: 'frameless'`,
`enableMarkdown: 'yes'` and `requestBody: 'x'` are refused). A `chatbot` node's
parse outcome is unchanged: `ChatbotSchema`'s twin did not move.

## `@object-ui/plugin-chatbot`

The `chatbot-enhanced` and `chatbot-floating` registrations type `schema` as the
published faces and drop the anonymous intersections. One consequence:
`chatbot-floating` used to write `disabled={schema.disabled}` and then spread
`{...props}` AFTER it — and `SchemaRenderer` always includes `disabled: verdict
|| undefined` in those props, so the raw read was overridden on every render.
With `disabled` honestly typed as `boolean | string` the raw union cannot be
forwarded into the panel's `boolean` prop, so the registration now names the
host verdict (`disabled: hostDisabled`) the way its two siblings have since
objectui#4431. No render outcome moves; the pin renders through the real host
both ways.

This ships as `minor` for `@object-ui/types` because it widens the published
surface with two new node types, two new Zod twins and one new type alias;
`ChatbotSchema`'s own accept set does not move: objectui's major is pinned to `@objectstack`'s
(`scripts/check-changeset-no-major.mjs`), and objectui's own contract changes
ship as `minor` with the semantics spelled out — as above.
