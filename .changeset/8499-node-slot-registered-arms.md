---
'@object-ui/types': minor
---

Give `AnyComponentSchema` arms for seven registered, live renderers that resolved in
no arm at a declared node slot (objectui#8499).

**The defect, and the direction it ran.** Nine `type` spellings sat at DECLARED node
slots in this repository's own corpora and resolved in no arm of the component union.
Eight were registered renderers with fixtures proving they draw; the ninth
(`my-component`) is the reader's own plugin component and carries a written exemption
in `scripts/check-doc-component-types.mjs`. A reader following
`content/docs/utilities/runner.mdx`'s own instruction — "copy one, wrap it in a page
document … and save it as `src/app-data/pages/index.json`" — got a document that
**renders correctly in the browser and is refused by `objectui check`**. That is the
expensive direction: the likely reaction is to stop trusting the validator.

It was invisible because `check:doc-types` judges a `type` literal against the
RENDERER REGISTRY (656 keys) and not against `AnyComponentSchema` (107 arm literals).
The two faces disagreed by construction and nothing compared them at a node slot.

**What is now authorable.** Four new arms, 47 new `type` literals, taking the union
from 107 to 154:

- `SemanticElementSchema` (`zod/layout.zod.ts`) — the seven HTML sectioning tags
  `renderers/layout/semantic.tsx` registers: `aside` `main` `header` `nav` `footer`
  `section` `article`.
- `HtmlElementSchema` (`zod/layout.zod.ts`) — the 37 safe flow/inline tags
  `renderers/basic/html-elements.tsx` registers (`h1`…`h6`, `p`, `a`, `ul`, `img`, …),
  plus the per-tag keys that module forwards to the DOM (`href`, `target`, `rel`,
  `title`, `src`, `alt`, `width`, `height`, `dateTime`, `cite`).
- `InputShorthandSchema` (`zod/form.zod.ts`) — `email` / `password`, the two aliases
  `renderers/form/input.tsx` registers onto the `input` renderer with `inputType`
  pinned. `inputType` is deliberately NOT declared on this arm: the wrapper spreads
  its own value last, so an authored one is overwritten.
- `UiCalendarSchema` (`zod/form.zod.ts`) — `ui:calendar`, the date-picker primitive
  `renderers/form/calendar.tsx` registers under exactly that key (`skipFallback`,
  because bare `calendar` belongs to the plugin-calendar view).

Every arm this change AUTHORS declares only keys its renderer demonstrably reads —
the `BarChartSchema` discipline objectui#6318 established for the same class of gap.
⚠️ One arm INHERITS more than that, and it is stated rather than glossed:
`UiCalendarSchema` extends `CalendarSchema`, so it carries `minDate` and `maxDate`,
which `renderers/form/calendar.tsx` reads zero times (controls, same file: `mode` 3,
`className` 4 — it reads `mode`, `value`, `defaultValue` and `className`). That is
pre-existing debt on `CalendarSchema`, not something this change introduces, and
narrowing it here would be a different card's accept-set movement; the extend is what
keeps the two spellings one schema.

**A repo-tracked metric moves, declared knowingly.**
`scripts/measure-strict-authoring-face.mjs` reports `unexportedNodeSchemas` — node
types reachable only through the union because no schema for them is exported by name
from `@object-ui/types/zod`, "so no consumer can validate one alone". The four new
arms are not in that barrel's explicit export lists, so the metric moves from
`[breadcrumb, object-tree]` to **49 node types** (the same 2, plus this change's 47
new literals). Measured at this branch's head, not estimated.

Why 49 is acceptable here where 2 was a defect: the 2 were data blocks a consumer had
a standing reason to validate on their own, and objectui#7917 (PR #8777, open at the
time of writing, and the holder of `zod/index.zod.ts`) exists to export exactly those.
The 47 added here are HTML primitives and two input aliases — they have no per-tag
consumer to serve, and exporting a `SemanticElementSchema` / `HtmlElementSchema` pair
would publish a NAMED authoring surface (`z.enum` families, not per-tag schemas) that
this card's ruling does not cover: the ruling is "arm the registered renderers", not
"add public exports to `@object-ui/types`". So the metric is left to move and said out
loud instead. ⇒ Whoever next runs that measurement should expect 49, and whoever
wants the number back down should treat naming these families as its own decision.
If PR #8777 lands first, the same movement reads `0` to `47`.

**Accept-set movement is widening only.** Nothing that parsed green parses red. Each
arm still judges VALUES: `{ type: 'img', width: true }`, `{ type: 'password',
required: 'yes' }` and `{ type: 'ui:calendar', mode: 'agenda' }` are all refused, and
a `type` nothing registers (`stat-card`, `metric-card`, `h1ZZ`) is refused at the root
and at every node slot exactly as before.

**Every one of these types becomes legal at EVERY node slot** — measured: 249
arm-level node slots before this change and 257 after, plus 36 on nested schemas,
all spelled with the one `SchemaNodeSchema`. A slot-constrained shape is not expressible by adding arms: a
discriminated union selects its arm from the authored literal alone, so a slot has no
say. That is a per-slot vocabulary programme, not a variant of this change.

**`line-chart` is deliberately NOT armed.** The card lists it among the eight as a
live renderer; measured here it is not. `apps/console/src/register-plugins.ts`
registers it as a lazy stub pointing at `@object-ui/plugin-charts`, and that package
never registers the key, so it resolves to nothing at render time. Arming it would
invent a capability rather than name one. `__tests__/node-slot-registered-arms-8499.test.ts`
pins the absence together with its reason, so registering the key for real turns red.

**Downstream.** `objectui check` stops reporting these documents. Its
`check-validity-recogniser` suite measured 658 registered types against 102 arm
literals when it was written; re-measured here it is 656 against 154, so the
"registered but not modelled" bucket goes from 558 to 505 and its fixture moved off
the HTML primitives (they are modelled now) onto `metric-card`, whose absence from the
union is ruled rather than pending.
