---
'@object-ui/react': patch
---

`useETagCache`, `useGlobalUndo` and `useOffline` stop writing their config refs
during render (objectui#6797).

Each of the three kept a "latest value" ref that was assigned in the render
body, one `react-hooks/refs` warning apiece on this base
(`useETagCache.ts:204`, `useGlobalUndo.ts:57`, `useOffline.ts:262` — all three
`Cannot update ref during render`, all three the WRITE only; unlike
`useSchemaPersistence` none of them also READ a ref during render). A ref
written in the render body is also written by renders React discards or
replays — StrictMode's double render, a Suspense retry, a concurrent
interruption — so a tree that never committed could publish its config to
callbacks that outlive it.

The write moved to `useInsertionEffect` in all three, but that shape was chosen
per hook rather than carried over, because what each ref protects differs:

- **`useETagCache`** — five resolved config scalars read by five `useCallback`s
  with `[]` deps whose identity is part of the published result. Re-keying them
  on the config values would have changed `fetchWithETag`'s identity whenever a
  caller's `ttl` moved, re-firing consumer effects keyed on it, so the ref
  stays.
- **`useGlobalUndo`** — the whole options bag. Every caller passes a fresh
  inline literal with inline `onUndo` / `onRedo` closures, and the keydown
  effect is keyed on `undo` / `redo`, so the ref is the only thing keeping
  those two stable while still reaching the newest callbacks.
- **`useOffline`** — `config.sync`, read by one caller (`sync`) that is
  *already* unstable (deps `[enabled, queue]`). Here the ref protects RETAINED
  closures rather than an identity: the auto-sync effect deliberately captures
  a `sync` and fires it 100ms later, and that closure must still see the newest
  `batchSize`. Dropping the ref for a `syncConfig?.batchSize` dep would have
  changed what that retained closure reads, so it was rejected.

`useInsertionEffect` runs in the mutation phase — ahead of every layout effect,
ref attachment and paint — so the only window any of the three defers is the
render phase itself, where none of the affected callbacks is legally callable.
`useEffectEvent` would be the idiomatic answer but is React 19.2+, and this
package's peer range starts at React 18.

**No behavioural change is claimed for callers that exist today**: reverting any
of the three implementations leaves the whole suite green, and the new pins pass
against the old code and the new code alike. They guard the next edit — each
file's discriminating pin fails under both `useEffect` and `useLayoutEffect`.
