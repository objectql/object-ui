---
"@object-ui/plugin-map": patch
---

Fix the two remaining `object/api/value` claims that objectui#5019 (PR #5162) left
behind — its dispatch was scoped to only the "API Provider" section of
`content/docs/plugins/plugin-map.mdx`, so the same false claim survived in the Features
list and in the `ObjectMap.tsx` file-header JSDoc:

- `content/docs/plugins/plugin-map.mdx:24` (Features list): "Works seamlessly with
  object/api/value data providers" → "Works seamlessly with object/value data providers".
- `packages/plugin-map/src/ObjectMap.tsx:20` (file-header JSDoc): "Works with
  object/api/value data providers" → "Works with object/value data providers".

`provider: 'api'` still hits `console.warn('API provider not yet implemented for
ObjectMap')` and returns an empty record set (`ObjectMap.tsx:584`); `endpoint`/`method`
have no read point in the package. Implementing the `api` provider is capability
expansion and is explicitly out of scope here, same as it was for #5019.

No runtime behaviour changes — a source comment and a docs line only.
