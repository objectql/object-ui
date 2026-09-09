---
---

Couple the `waitFor`s in `providerCtxIdentity.discarded.test.tsx` to the arrays
their assertions read (objectui#8688). Two waits were keyed on the request `log`
— pushed when a request is ISSUED — and then read `ctxSeen`, which only fills
once the response has landed and `MePermissionsProvider` swaps `loadingFallback`
for `children`; on an unfavourable ordering the read ran against an empty array.
Test only; no package is released by this change.
