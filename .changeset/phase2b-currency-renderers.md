---
"@object-ui/i18n": patch
"@object-ui/fields": patch
"@object-ui/plugin-grid": patch
"@object-ui/plugin-dashboard": patch
"@object-ui/plugin-detail": patch
"@object-ui/plugin-gantt": patch
"@object-ui/components": patch
---

fix(currency): resolve the tenant default currency across the long-tail renderers

Phase 2b of the currency-resolution work (ADR-0053). The cell/field renderers
already funnelled through `resolveFieldCurrency` + `useLocalization` (#1856),
but the rest of the renderers still hard-coded `USD` or read only one of
`currency`/`defaultCurrency`. They now share the same resolution chain — explicit
field currency -> `currencyConfig.defaultCurrency` -> legacy `defaultCurrency` ->
tenant `localization.currency` -> plain number:

- `plugin-dashboard` `ObjectMetricWidget` (inferred currency), `ObjectDataTable`
  (symbol-format fallback).
- `plugin-grid` `useColumnSummary` (footer agrees with the cells) and
  `ObjectGrid` (compact amount + name-inferred currency cells).
- `plugin-detail` `DetailView` summary metrics.
- `plugin-gantt` `ObjectGantt` currency tooltips.
- `components` `element:number` (`format: 'currency'`) — tenant default instead
  of a baked-in `USD`, and renders with the tenant locale.

`resolveFieldCurrency` now lives in `@object-ui/i18n` (co-located with
`useLocalization`, which supplies the tenant default); `@object-ui/fields`
re-exports it, so the existing import path is unchanged. No behavior change when
no tenant currency is configured — a field that declares its own currency, or a
deployment with no `localization.currency`, renders exactly as before.
