---
'@object-ui/react-runtime': patch
---

Give `@object-ui/react-runtime`'s React peer range an upper bound: `peerDependencies.react` narrows from `>=18` to `^18.0.0 || ^19.0.0`, the spelling the other 30 react peers in the fixed version group already declare (objectui#3741).

An unbounded range is a promise that grows on its own. `>=18` satisfies React 20 the day React 20 is published — a major this package has never been built against, let alone tested — and it makes that claim from an already-published manifest, with no commit and no review to point at. This package is the least appropriate place in the workspace for such a promise: it vendors react-runner and evaluates author-supplied JSX against the *host's* React, so a host on an untested major does not fail at this package's boundary, it fails somewhere inside the page it rendered.

Nothing in the package wanted the wider range. Its entire React surface is `Component`, `createElement`, `isValidElement`, `ReactElement` and `ReactNode`, all unchanged in React 19 and none of them touching anything React 19 removed. The range was never a stated constraint either: `>=18` was written when the package was created on 2026-06-30 (`d23d6ebfa`, PR #2105) and no commit since revisited the line. The workspace pins React to `19.2.8` through the root `pnpm.overrides`, so 19 is the only major this package's tests have ever exercised — the unbounded upper end was untested by construction.

The README sentence restating the range moves with it, and the doc gate that compares the two (`doc-version-claims.test.ts`, objectui#3717) keeps them in step from here.

A new pin, `scripts/__tests__/react-peer-range-norm-3741.test.ts`, now asserts the norm across every workspace manifest, because this was the third package born off-norm and the first two were each corrected in isolation: `plugin-dashboard` was born narrow and fixed on 2026-05-08 (`d2b6ecec6`), `plugin-report` was born narrow and fixed in objectui#3690 (PR #3727) after a React 19 consumer hit `ERESOLVE` on install, and this one was born unbounded. The existing doc gate could not have caught any of them — it checks a README against its own manifest, and react-runtime's two sides agreed with each other while both said `>=18`.
