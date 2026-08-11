---
'@object-ui/core': patch
---

Retire `params.newTab` on a url action — `openIn: 'new-tab'` is the sanctioned spelling

`ActionRunner`'s navigator read a legacy `params.newTab` escape hatch below `openIn` and above the external-URL heuristic. That read is removed, executing the objectstack#6828 maintainer ruling of 2026-08-10, whose contract half shipped in objectstack PR #7375: the url-side readings of an object-form `params` are retired, not renamed.

Nothing that ever validated can regress. `params` is declared as `z.array(ActionParamSchema)`, so an object-form `params` has always failed the props parse — the fallback could only fire on a stack the spec refuses. The removal also closes a collision hazard: a params dialog declaring a field named `newTab` had the user's own collected input silently steering navigation.

`openIn: 'self' | 'new-tab'`, the legacy `navigate.newTab` modifier on the `navigation` shape, and the external/relative default are all unchanged.
