---
'@object-ui/react': patch
---

`useETagCache` builds its config object once per hook instance instead of once
per render (objectui#6817).

`useRef({ enabled, storage, storagePrefix, maxEntries, ttl })` evaluated that
literal on **every** render and kept only the first result, so every later
render allocated a five-key object that was discarded. It now comes from a
`useMemo` keyed on the five values, which is also what the ref's
`useInsertionEffect` write publishes.

`patch`, not `minor`: nothing a published consumer can observe changes. The
public shape, the returned callbacks' identities and the values the stable
`[]`-deps callbacks read off the ref are all unchanged — the object's identity
is private to the hook, so the only difference is the allocation that no longer
happens. Same pattern PR objectui#6796 repaired in `useSchemaPersistence`; this
is the half of that class the `react-hooks/refs` rule structurally cannot see,
which is why it needed a test rather than a lint fix.
