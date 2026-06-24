---
"@object-ui/plugin-form": patch
---

fix(plugin-form): call `useRecordContext` unconditionally; drop impure render-time `Date.now()`

`LineItemsPanel` wrapped `useRecordContext()` in a `try/catch`, which ESLint flagged
as `react-hooks/rules-of-hooks` ("React Hook is called conditionally") — a genuine
hook-order hazard if the `catch` ever fired part-way through render. `useRecordContext`
returns `null` outside a `<RecordContextProvider>` and never throws, so the guard was
dead code; it's now called unconditionally at the top level and the `null` case is
handled by the existing optional chaining.

Also clears a second pre-existing lint error: `EmbeddableForm` now seeds `mountedAtRef`
from `0` instead of calling the impure `Date.now()` during render (the mount effect
already overwrites it before any submit, so the anti-bot min-fill check is unchanged),
fixing the react-compiler "Cannot call impure function during render" error. No
behavior change.
