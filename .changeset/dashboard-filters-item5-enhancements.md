---
"@object-ui/react": minor
"@object-ui/core": minor
"@object-ui/plugin-dashboard": minor
---

Dashboard-level filters — the three #2578 item-5 enhancements (framework#2501):

- **react**: nested `PageVariablesProvider`s now MERGE instead of shadowing
  wholesale. A filtered dashboard embedded in a Page with its own `variables`
  keeps the outer page variables readable inside widget subtrees (`page.*`);
  an inner definition shadows only the SAME name; writes route to the scope
  that defines the variable (writing an outer-defined name from inside the
  nested subtree updates the outer provider); `resetVariables` stays local.
  Names defined nowhere still write locally, exactly as before.
- **core**: `buildWidgetScopedFilter` accepts an optional `knownFields` set —
  a DEFAULT binding whose target field is not on the widget's object is
  skipped with a console warning instead of emitting a query the backend
  empty-matches. Explicit `filterBindings` strings are always honoured (a
  typo surfaces as a visibly empty widget, never a silently dropped filter).
  Omitting `knownFields` preserves the previous unchecked behaviour.
- **plugin-dashboard**: `DashboardRenderer` feeds `knownFields` from
  `dataSource.getObjectSchema` for inline `object` widgets (best-effort —
  unchecked while metadata loads or when the source can't describe objects).
  `optionsFrom` dynamic filter options now resolve DISTINCT values
  server-side via a dataset GROUP BY (`queryDataset` with an inline draft)
  when the data source supports it, falling back to the previous client-side
  top-200 dedupe otherwise.
