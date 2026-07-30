---
"@object-ui/plugin-detail": patch
"@object-ui/console": patch
---

fix(record): register the record:\* blocks under one key, prefixed once

Eleven blocks in plugin-detail were registered as
`register('record:x', …, { namespace: 'record' })` — an already-prefixed name
handed to a registry that prefixes it again. Each landed at
`record:record:x`, and the key authors actually resolved, `record:x`, was the
un-namespaced *fallback* rather than the intended registration. The registry
carried 23 keys for 12 components.

Nothing failed, which is why it survived: `getPublicConfigs()` rewrites `type`
to the curated tag, so the doubled name never reached the contract, the
manifest, or the JSX surface. It was visible only when enumerating the registry
directly — which is what objectui#3013's reverse check does.

Registering the bare name is what makes `namespace` correct, and
`skipFallback: true` is what keeps the fallback from claiming that bare name
globally. Without it these would take over `details`, `path`, `history`,
`alert` … as top-level tags; `alert` is the live case, owned by `ui:`. Every
block stays reachable exactly as `record:<name>`, and 23 keys become 12.

`record:line_items` needed no change — it was the one already registered this
way, which is what made objectui#3006's near-miss possible in the first place.

Two console assertions hold the shape: no key carries a doubled prefix, and no
`record:*` block owns the bare spelling of its own name.
