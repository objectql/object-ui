---
'@object-ui/i18n': patch
---

`useObjectLabel` now keeps a stable identity when no i18next instance is bound,
so the memoization it advertises holds on the no-provider path too
(objectui#5564).

react-i18next's `useTranslation` builds its return value out of a fresh `{}` on
every render when it has nothing to bind to (`const finalI18n = i18n || {}`,
which then feeds that hook's own `useMemo` deps), so the `i18n` object arrived
with a new identity each render. `useObjectLabel` keyed its memo on `[t, i18n]`,
so the memo never held: measured 4 distinct returned objects across 4 renders
with no instance, against 1 with one. That is the wrong way round — the memo
exists to stop downstream `useMemo`/`useCallback` deps from being re-keyed in
heavy consumers, and `useSafeFieldLabel`'s docstring names the no-provider case
as the one it exists to serve.

Both memo dependencies are now pinned to module-level constants while no
instance is bound. The substitution is unobservable rather than merely
convenient: every `t()` call in the module sits inside a
`for (… of getAppNamespaces())` loop, and `getAppNamespaces()` returns `[]`
under exactly the same "is there a usable instance" predicate — so while the
substitution is in effect, the closures cannot read either value. When an
instance appears the dependencies become the live values again, so a provider
mounting after first render recomputes the object exactly once and resolves
real translations from then on.

No API change: no new exports, no signature changes, and the returned surface is
identical on both paths. Direct `useObjectLabel()` consumers are fixed alongside
`useSafeFieldLabel()` ones, including `ListView.filterFields` — the consumer the
memo's own docstring names.
