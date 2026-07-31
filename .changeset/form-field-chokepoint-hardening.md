---
"@object-ui/types": patch
"@object-ui/plugin-form": patch
---

fix(form): the spec↔runtime form-field chokepoint stops dropping spec 17 vocabulary, and the validator stops contradicting the renderer — #3090

`normalizeSectionField` — the one translation point between the spec's authored
form-field shape (`field` = object-field reference) and the runtime shape
(`name` = data path) — silently dropped four spec keys, worst of all the
ADR-0089 **canonical** `visibleWhen` spelling while the deprecated `visibleOn`
worked. Now:

- view-level `visibleWhen` routes into the view-level slot (`visibleOn`) so it
  ANDs with the object-level rule instead of clobbering it, and the wizard's
  final-submit gate folds the same slot into its verdict (before, a required
  field the view itself hides could block submission from off-screen);
- `dependsOn`, `keyField`, and `disclosure` carry through;
- a behavioral parity gate walks the spec `FormFieldSchema` key set — a key the
  spec adds fails as unmapped, a key it retires fails as stale.

`SelectOptionSchema` is now derived from `@objectstack/spec/data` by reference
(it used to strip `color` — which `@object-ui/fields` renders — plus `default`
and the per-option `visibleWhen` gate), with pinned divergences (`value`
widened for UI forms, `visibleWhen` on the #2212 wire contract) and documented
UI-only extensions (`disabled`, `icon`). `SelectOption` (TS) gains `color` and
`default`.

`FormFieldSchema` (the runtime vocabulary `objectui validate` enforces) now
covers every key the `FormField` interface declares — `widget`, `dependsOn`,
`hidden`, `readonly`, `visibleOn`/`visibleWhen`/`readonlyWhen`/`requiredWhen`,
`span` — and `type` is optional, matching the interface. A typo'd predicate now
fails loudly instead of being stripped; spec-shape fields (`{ field: … }`) are
still rejected, pinning the two-layer boundary.
