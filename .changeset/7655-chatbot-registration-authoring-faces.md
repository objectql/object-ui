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
  plus `enableMarkdown`, `enableFileUpload`, `onClear`, `floatingConfig`
  (`FloatingChatbotConfig`) and `displayMode`. No `maxHeight`,
  `processVisibility` or `surface` — the floating registration forwards none of
  them.
- Neither face declares `ChatbotSchema`'s six legacy members (`loading`,
  `showAvatars`, `userAvatar`, `assistantAvatar`, `markdown`, `height`) — no
  registration reads them — and neither redeclares `disabled`, which stays
  `BaseSchema`'s `boolean | string` (objectui#7087).

**Two keys MOVED off `ChatbotSchema`:** `displayMode` and `floatingConfig`. The
`chatbot` registration has no read, no designer control and no `defaultProps`
seed for either; both are `chatbot-floating`'s. `displayMode` crossed UNCHANGED
— same `'inline' | 'floating'` type, still unmirrored, still read by nothing —
because its fate is objectui#7654's and that card is parked on a maintainer
decision; a tripwire test pins that any value still parses green. Nothing was
retired, tombstoned, mirrored or made live.

## Zod twins, in lockstep

`@object-ui/types/zod` gains `ChatbotEnhancedSchema` and `ChatbotFloatingSchema`
(and `ComplexSchema` routes the two new discriminants). Every declared key is an
arm except: the three runtime slots (`onError`, `onSend`, `onClear`), refused by
name per objectui#6124; and, on the floating twin only, `floatingConfig` (no
`FloatingChatbotConfig` mirror exists — minting one is objectui#6152's axis) and
`displayMode` (objectui#7654). The twins mirror the API body params under the
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
surface with two new node types and two new Zod twins, and moves two declared
keys from one face to another: objectui's major is pinned to `@objectstack`'s
(`scripts/check-changeset-no-major.mjs`), and objectui's own contract changes
ship as `minor` with the semantics spelled out — as above.
