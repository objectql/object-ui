---
---

Date the two query-absence controls in
`ListView.objectProviderBinding-7477.test.tsx` to a bounded settle window
rather than to mount (objectui#8705). Both `not.toHaveBeenCalled()` pins sat
straight after a `waitFor` that is satisfied on the first commit, so an
implementation that starts a query 50ms after mount passed them; under the
repair that same forced implementation turns them red. Test only; no published
behaviour changes and no package is released by this change.
