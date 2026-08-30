---
'@object-ui/plugin-form': minor
'@object-ui/console': patch
---

Publish the create-payload rule from `@object-ui/plugin-form`'s entry, so a
second form renderer can call it instead of composing it by hand
(objectui#6059).

Newly importable from `@object-ui/plugin-form` — two functions, nothing else:

```typescript
import { omitServerResolvedDefaults, isRequiredInForm } from '@object-ui/plugin-form';
```

- `omitServerResolvedDefaults(values, objectSchema)` — drop the keys a CREATE
  payload must leave to the producer: a field whose declared `defaultValue` is a
  runtime instruction (`NOW()` / `current_user`, or a CEL envelope) and whose
  submitted value is empty. `ObjectQL.applyFieldDefaults` resolves a declaration
  only for a field that arrives absent or null, so submitting a blank stores
  `''` and silently defeats it. **Create-only** — the caller keeps the mode gate.
- `isRequiredInForm(field, isCreateForm)` — the `required` a form should
  enforce, given the mode. Published as the pair's other half on purpose:
  excusing a server-owned field from `required` and then submitting the key
  anyway is not half a fix, it is no fix.

Both are pure functions over plain data (no React, no registry). The rest of
`schemaDefaults.ts` — `seedCreateValues`, `schemaDefaultValues`,
`isSeedableDefault`, `isCreateFormMode`, `SeedContext` — stays module-private,
and `isRuntimeDefault` stays `@object-ui/core`'s to publish.

No behaviour change. The console's `FormPage` now calls the published helper
instead of composing `isRuntimeDefault` + `isMissingForRequired` locally; its
create payload is decided identically before and after, pinned against the
deleted implementation over the full matrix of default shapes, value spellings
and both modes.
