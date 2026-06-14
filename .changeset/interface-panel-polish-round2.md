---
"@object-ui/app-shell": minor
---

interface page: Add-Record config now takes effect; view picker mirrors runtime resolution

- **Fix: `interfaceConfig.addRecord` did nothing.** `InterfaceListPage` never forwarded `addRecord` into the schema it hands to `ListView`, so the panel's Add-Record toggle/position/mode were silently dropped — the button could never appear on an interface page. Now `addRecord` is passed through (ListView already gates the button on `addRecord.enabled` across all visualizations).
- **`view-ref` picker no longer mislabels resolvable values.** A stored `sourceView` like the bare `default` was tagged "(not in object)" even though the runtime resolves it. The widget now mirrors `InterfaceListPage.resolveSourceView` (exact name / `<object>.<name>` suffix / `default`-`list` special-case) via an extracted, unit-tested `resolveStoredViewRef`, showing the matched view's label (e.g. "All Tasks → showcase_task.default") instead of a false warning.
