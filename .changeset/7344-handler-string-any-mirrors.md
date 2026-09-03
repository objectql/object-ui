---
'@object-ui/types': minor
---

The eight `on*` handler keys PR #7339's census could not see now refuse by name
(objectui#7344 — the objectui#6182 ruling of 2026-08-25 that the handler-expression
string dialect is not a supported authoring form, executed in the objectui#6124 shape).

**The accept set of published validators moves** (`@object-ui/types/zod`):

- Four mirrors declared the string dialect (`z.string()`) — `AppActionSchema.onClick`,
  `ReportBuilderSchema.onSave` / `.onCancel`, `DetailViewSchema.onBack` — so an authored
  `onBack: 'goBack'` parsed green and then reached a slot that CALLS it
  (`DetailView.handleBack`), throwing `onBack is not a function` at click.
- Three declared `z.any()` — `ActionSchema.onClick`, `DetailSchema.onBack`,
  `CRUDDialogSchema.onClose` — wider than the callable the TypeScript face declares, so
  any JSON value parsed green (the objectui#7069 direction).
- One, `CalendarViewSchema.onEventClick`, was `z.function()` in a multi-line spelling the
  anchored census missed.

All eight now carry `handlerKeyRefusal(key, disposition, label)`: an authored string, an
authored object and a live function are each refused at the key's own path with
`code: 'custom'` and a message that names the key, says why JSON cannot author it and
points at the node-type spelling. Nothing that used to be refused parses green.

**The TypeScript face, measured per key** — a function type only where a runtime consumer
reads a function, else `?: never`:

- Runtime slots (callable kept): `DetailViewSchema.onBack` (now `() => void`, the prop
  `DetailView` invokes — it declared `string`), `DetailSchema.onBack`, `ActionSchema.onClick`,
  `CalendarViewSchema.onEventClick`.
- Retired (`?: never`): `AppAction.onClick` (nothing reads `AppComponentSchema.actions[]`),
  `ReportBuilderSchema.onSave` / `.onCancel` (no `report-builder` renderer is registered),
  `CRUDDialogSchema.onClose` (no `crud-dialog` renderer is registered).

The three `views.zod.ts` `z.string()` keys that are event NAMES (`onViewChange`, the two
`onChange`, PR #6899) are untouched; their describe text says so and the new pin reads it.
`zod-mirror-parity.test.ts` records the three new runtime-slot drift rows;
`content/docs/core/app-schema.mdx` spells its `AppAction.onClick` row `never` and drops the
string example, the two edits the #7340 docs pin and `check:doc-snippets` require.
