---
'@object-ui/data-objectstack': patch
---

`ObjectStackAdapter.getApp` and `getPage` now address the `app` / `page` metadata
types in the singular, matching the other twelve `client.meta.*` call sites in this
file (objectui#4940).

`getApp` (`getItem('apps', …)`) and `probeAppAccess` (`getItem('app', …)`) addressed
the same metadata type sixty lines apart, and only `probeAppAccess`'s comment argued
its singular spelling was deliberate — the plural site was silent. Both plural sites
resolved today only because the server folds plural → singular
(`RestServer.metaTypeSingular` via `PLURAL_TO_SINGULAR` from `@objectstack/spec/shared`,
confirmed by reading both the mapping and the by-name route handler that calls it), so
this is consistency restoration rather than a behavior change — nothing a user hits was
broken, and nothing a user hits changes.

`appAccessProbe.test.ts` (objectui#4252's local pin for this same spelling) is extended
with two new cases asserting `getApp`/`getPage` pass the singular type to
`client.meta.getItem`, so a future revert to the plural spelling fails a test instead of
depending on the server-side fold staying in place.
