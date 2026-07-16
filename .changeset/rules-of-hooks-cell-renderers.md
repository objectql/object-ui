---
'@object-ui/fields': patch
'@object-ui/plugin-detail': patch
---

fix(fields+detail): resolve the pre-existing rules-of-hooks violations in the cell renderers

- `CurrencyCellRenderer` / `EmailCellRenderer` / `PhoneCellRenderer` called
  hooks (`useLocalization`, `useFieldLabel`, `useState`) **after** their
  empty-value early return — a value flipping between null and set changed
  the hook count between renders (latent "Rendered more hooks than during
  the previous render" crash). Hooks now run unconditionally before the
  early return.
- `useFieldLabel` wrapped `useObjectTranslation()` in try/catch; a throw
  after other hooks ran would desync hook order. The underlying hook is
  provider-safe (optional context + global i18n fallback), so the guard is
  removed.
- `ReferenceCellRenderer` no longer constructs JSX inside try/catch (the
  try can't catch render errors anyway) — the display string is computed in
  the try, rendered outside.
- `RecordMetaFooter`'s UserRef renders the registry cell renderer via
  `React.createElement` instead of a locally-assigned capitalized JSX tag
  (flagged as component-creation-during-render; the registry reference is
  stable).

No behavior change intended; eslint react-hooks errors on these files drop
to zero.
