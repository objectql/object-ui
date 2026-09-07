---
---

Test-only repair of two `Storage.prototype` spy instruments that graded green
without measuring what their names claimed (objectui#7786). No package is
released by this change and no runtime source is touched.

- `apps/console/src/__tests__/bootSplash.test.ts` — `it('survives a browser
  with no localStorage access')` injected its fault with
  `vi.spyOn(Storage.prototype, 'getItem')`, which never reached the script
  under test: happy-dom hands `localStorage` out through a proxy that has
  already bound `getItem`, and `vitest.setup.base.ts` may swap the store for a
  plain object that never inherited from `Storage.prototype` at all. Measured
  on Node 22.22.2, the version CI pins, a direct `localStorage.getItem(...)` in
  that test did not throw — so the case asserted that an ordinary boot does not
  throw, under a name promising a blocked browser. The fault is now injected
  where the script resolves it (the property-replacement shape
  `packages/i18n/src/__tests__/provider-locale-persistence.test.tsx` already
  uses against the same hazard), a counter-probe asserts the throw is
  observable before anything is graded on its absence, and a stored `dark`
  choice makes the expected `light` outcome reachable only when storage is
  genuinely unreadable.
- `packages/plugin-list/src/__tests__/UserFilters.addTab.test.tsx` — the
  load-bearing `expect(setItem).toHaveBeenCalledTimes(0)` is a negative
  assertion, which a blind spy satisfies for the wrong reason. It now proves
  the spy observes two writes the test makes itself, in both `sessionStorage`
  and `localStorage`, before asserting anything about writes the component did
  not make.
