---
'@object-ui/types': minor
'@object-ui/core': patch
'@object-ui/components': patch
'@object-ui/layout': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-ai': patch
'@object-ui/plugin-calendar': patch
'@object-ui/plugin-charts': patch
'@object-ui/plugin-chatbot': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-designer': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-editor': patch
'@object-ui/plugin-form': patch
'@object-ui/plugin-gantt': patch
'@object-ui/plugin-grid': patch
'@object-ui/plugin-kanban': patch
'@object-ui/plugin-list': patch
'@object-ui/plugin-map': patch
'@object-ui/plugin-markdown': patch
'@object-ui/plugin-report': patch
'@object-ui/plugin-timeline': patch
'@object-ui/plugin-tree': patch
'@object-ui/plugin-view': patch
---

**Breaking for authored metadata:** `ComponentInput.label`, `ComponentInput.defaultValue` and
`ComponentInput.advanced` are RETIRED on both faces (objectui#7493 item ① and objectui#7781;
maintainer ruling A of 2026-09-06, immediate, no deprecation window; ADR-0049 enforce-or-remove).
They are the three keys the manifest serializer does not forward, and nothing read them on any
publication or consumption path.

No manifest ever published them, so no consumer could ever have read them. `sdui-parser`'s
serializer (`packages/sdui-parser/src/index.ts`) forwards exactly six keys per input — `name`,
`type`, `required`, `enum`, `binding`, `description` — so a value authored under any of the three
never reached `sdui.manifest.json`, the generated JSX `.d.ts`, or a diagnostic; its boundary type
has no slot for them; the registry's data-source seam reads `name` only; and neither the designer
nor the app-shell inspectors consult registry `inputs` at all. A structural census over every
`inputs:` array in the repository (re-measured on this change's merge-base, `name` 951 and `type`
951 as the controls) counted the writes: `label` 908, `defaultValue` 245, `advanced` 9 — written on
nearly every registration, read by nothing.

FROM → TO, per key — all three **TOMBSTONED, not removed**, because the route was measured on
the built face before it was chosen: `ComponentInputSchema` is a non-strict `z.object`, and an
undeclared key parses GREEN and is silently STRIPPED, so a deletion would have swallowed 1,162
authored values in silence. The tombstone is what makes the refusal loud and by name.

- `label?: string` → `label?: never` on the interface, `retirementTombstone()` on the Zod mirror.
  Migration: delete the key. An input is identified by its `name` on every path that reaches it;
  nothing ever rendered a label for it.
- `defaultValue?: any` → `defaultValue?: never` / `retirementTombstone()`. Migration: delete the
  key. The renderer's own fallback read IS the default; tell the author about it in `description`,
  which IS published. (Tightening the type to `unknown` was ruled out: it closes no error class,
  since nothing reads the value.)
- `advanced?: boolean` → `advanced?: never` / `retirementTombstone()`. Migration: delete the key.
  No designer surface ever hid an "advanced" input; there is nothing to write instead.

The retirement kit: `?: never` on `ComponentInput` (`packages/types/src/base.ts`), so authoring one
is a `tsc` error at the registration site; `retirementTombstone()` on `ComponentInputSchema`
(`packages/types/src/zod/base.zod.ts`), so an authored value is REFUSED at parse time with
`code: 'invalid_type'`, the key named in the issue `path`, and the migration note as the message
(one string, both channels). Pinned in
`packages/types/src/__tests__/component-input-retired-keys-7493.test.ts`, which also holds a
tree-scoped absence census over every `inputs:` array under `packages/**` and `apps/**`.

Accept-set change, stated plainly for reviewers: a document that sets any of the three keys on a
`ComponentInput` used to parse GREEN (the value was then dropped by the serializer) and now parses
RED. Every in-repo authoring site — 1,199 keys across 110 registration files, the three standalone
`ComponentInput[]` arrays and the two named input arrays `tsc` found included — is deleted in the same change, as the ruling's split rule
requires; the `WidgetRegistry` seam no longer copies the widget-manifest values onto the synthesized
`ComponentInput` (they fed nothing), and the data-source declaration `ELEMENT_DATA_SOURCE_INPUT`
drops its `label`. The patch entries on the other packages record exactly that: their registrations
stop authoring inert keys, with no runtime or published-manifest change.

The nine test files that read `defaultValue` off a registration were re-pinned against the
renderer's ACTUAL default (its own fallback read, or the `defaultProps` it ships) instead of the
declaration that went away; two assertions that only restated the shadow default were dropped with
the reason on the line.

The in-repo zero is what was measured. Whether anything OUTSIDE this repository writes these keys
is not measurable from here (the objectui#5674 limit); converting such a write from a silent drop
into a named refusal is exactly what the tombstones buy. `WidgetInput`'s own `label` /
`defaultValue` / `advanced` (the widget-manifest face) stay declared and writable — nothing has
ruled on that face; that it now has no reader either is recorded as objectui#7911.
