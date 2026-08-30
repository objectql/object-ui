---
'@object-ui/permissions': patch
---

Both permission providers now build their context value where React cannot discard it

`PermissionProvider` built its context value in a `useMemo` over four
`useCallback`s, and `MePermissionsProvider` in a `useMemo` over six. Neither
carries a semantic guarantee: React is permitted to discard the cache and
recompute even when the dependency list compares equal, and every one of those
factories builds a fresh object. A discard would therefore hand
`PermCtx.Provider` a NEW context value with every permission it carries
unchanged — which moves the key `usePermissions()` caches on, and re-runs the
consumer chain that names it: `ListView`'s data-fetch effect (an extra
`dataSource.find`), `DetailView`'s gatedSchema, `ObjectForm`, `ModalForm`,
`ObjectGrid` and `RelatedList`.

⚠️ This is **hardening, not a repair**. Nothing misbehaves today: on this
repo's pinned React 19.2.8 the cache is not discarded spontaneously — 51
re-renders with no provider, 51 with one and 42 under `StrictMode` each
returned one identity — and there is no `Activity`/Offscreen subtree here,
which is the documented case where React does throw memo caches away. What is
removed is the dependency on React continuing not to exercise a licence it
holds.

Each cached member and each context value is now keyed on the identities of the
inputs it is derived from, in a module-level `WeakMap` React has no say over —
the same technique that made `usePermissions()`'s own return discard-proof one
link down the chain. The dependency sets are unchanged, so nothing churns more
often than it did, and a genuine permission change still publishes a new
context value to every consumer. Two providers given the same inputs now share
one context value, which is stricter than the per-instance memo it replaces.

No published export changes, and the context carries exactly what it carried
before.
