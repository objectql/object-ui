---
"@object-ui/fields": minor
"@object-ui/components": minor
---

**BREAKING (v17)** — field widgets receive their metadata on ONE key, `field`.
`schema` is removed from the widget contract (objectui#3233).

## What changed

`schema` was a second carrier for what `field` already means. Two producers fed
it: `SchemaRenderer` passed the authored node as `schema`, and the form
renderer's `renderFieldComponent` passed `schema={props.field || props.schema ||
props}` *alongside* `field`. The predictable result was ~30 widgets resolving
their config as `field || schema` — one concept, two spellings, a de-facto
second contract (AGENTS.md #0.1).

- `FieldWidgetComponentProps` no longer declares `schema`. Reading
  `props.schema` is now a compile error, not a silent `any`.
- Both producers converged. The form renderer passes `field` only. The SDUI node
  → `field` translation happens exactly once, in a new registration adapter
  (`withFieldCarrier`), which every built-in field widget is registered through.
- All `field || schema` reads in `@object-ui/fields` are now plain `field` reads.

## Migrating a widget you wrote

**Reading the metadata** — replace the fallback with the single key:

```diff
-const config = field || (props as any).schema;
+const config = field;
```

**Registering a widget** — if your widget can be rendered from a schema node
(anything `SchemaRenderer` dispatches, not just forms), wrap it once so it still
gets `field`:

```diff
+import { withFieldCarrier } from '@object-ui/fields';
+
-ComponentRegistry.register('color', ColorField, { namespace: 'field' });
+ComponentRegistry.register('color', withFieldCarrier(ColorField), { namespace: 'field' });
```

`withFieldCarrier` forwards the node **by reference** — nothing is copied,
narrowed or renamed — and consumes `schema` so it cannot reach the DOM through a
widget's `...props` spread.

A third-party widget that still reads `props.schema` and is **not** re-registered
through the adapter will read `undefined` in v17 and silently render an empty /
default state. That is the deliberate cost of a major boundary: one contract
beats N dialects, and a widget that picks the wrong spelling should fail at
compile time rather than work under one host and not another.

## What did NOT change

- **Host metadata (SDUI JSON) is untouched.** No authored schema changes; this is
  a change to how widgets are *written*, not to what apps declare.
- **`schema` is still the universal SDUI prop** every registered component
  receives from `SchemaRenderer` (`element:*`, `page:*`, grids, reports). Only
  the *field-widget* contract retired it. In particular `renderFieldComponent`
  still passes `schema` when a form field type resolves to a plain component
  through the bare-name fallback (e.g. `type: 'text'` reaching the display text
  widget) — that component's contract is the node, and dropping it there would
  render `undefined.className`.

## Payload equivalence

Every path that used to deliver a payload through `schema` now delivers the
identical object through `field`, and both halves are pinned by tests asserting
**object identity**, not shape:

- form path — `packages/components/src/renderers/form/__tests__/form-field-carrier.test.tsx`
- SDUI path — `packages/fields/src/__tests__/field-carrier-sdui.test.tsx`
