---
'@object-ui/permissions': patch
---

`usePermissions()` now returns an identity React cannot discard (objectui#6724).

The hook cached its return in a `useMemo` keyed on `[ctx]`, and both branches build a
fresh object — an object literal when no provider is mounted, a spread of `ctx` when one
is. `useMemo` carries no semantic guarantee: React may throw the cache away and recompute
even when `[ctx]` compares equal, and that hands the caller a new identity while every
permission it carries is unchanged.

That matters because consumers name this value in dependency arrays — 13 arrays across 6
files: `ListView`'s data-fetch effect (`perms`), `DetailView`'s `gatedSchema`,
`ObjectForm`, `ModalForm`, `ObjectGrid`, `RelatedList`. A discard alone re-ran the fetch
effect and re-issued `dataSource.find` with nothing an author or a caller controls having
changed. Same family as objectui#6018 / #5976 / #6591 / #6592 / #6697.

The by-identity dependency at the consumers is the correct shape and stays: what they read
off this object is the verdict FUNCTIONS (`checkField(object, field, 'read')`,
`can(object, 'update')`) over an open set of field names, which flatten to no fixed list of
primitives the way objectui#6592's `dataConfig` members did. So the fix is at the hook,
where the identity can be made trustworthy:

- the decoration becomes a plain function of `ctx` — the same context value always yields
  the same object, because the mapping lives in a module-level `WeakMap` React has no say
  over, keyed weakly so it dies with the provider's value. That is strictly stronger than
  the memo it replaces: the identity is now stable across every component reading the same
  provider, not just across one component's re-renders. It also costs no hook, so there is
  no render-phase ref write and no state adjustment to reason about.
- the no-provider answer becomes one shared frozen module constant. Every member is a pure
  constant function, so there was never anything per-instance to keep, and a single frozen
  object cannot churn in any component for any reason.

A new context value still produces a new identity, on purpose: that is a real permission
change and every consumer must see it.

No permission value moves: the returned object still spreads `ctx` by identity and derives
`can`/`cannot` from `ctx.check`, and the documented no-provider fallbacks (`isLoaded:
false`, `userId: null`, `systemPermissions: undefined` with `hasCapabilities` fail-open —
objectui#5683 / #4656) answer exactly as before.

Measured while fixing, and worth recording: on React 19.2.8 this repo has no reproduction —
51 re-renders with no provider, 51 with one and 42 under `StrictMode` each returned ONE
identity, and there is no `Activity`/Offscreen subtree here. This closes a latent hazard,
not an observed re-fetch. The providers' own context-value memos are the remaining link in
the same chain (objectui#6813).
