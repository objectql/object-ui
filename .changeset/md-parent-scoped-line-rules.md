---
"@object-ui/plugin-form": patch
---

B2 follow-up (#1581): parent-scoped conditional rules in inline grids — "paid invoice → lock lines". `MasterDetailForm` now binds the live header record to every line-item grid as `parent`, so a column's `readonlyWhen` / `requiredWhen` CEL rule can react to the header (e.g. `parent.status == 'paid'` locks quantity / unit price / product when the invoice is paid). The line grids + document totals moved into a dedicated `<MasterDetailLines>` child that owns the scraped header record, so a header edit re-renders only the lines and never resets the header `ObjectForm`'s react-hook-form state mid-edit; the scrape is deduped by value to avoid needless churn. (`@object-ui/fields`' `GridField.contextRecord` and column-rule derivation already existed — this wires the last link.)
