---
---

Test-only change: the two `app-shell` `console/home` HomePage suites that boot the real
runtime-config module (`HomePage.marketplaceDisabled.test.tsx`,
`HomePage.aiStudioDisabled.test.tsx`) now serve `GET /api/v1/runtime/config` and
`GET /api/v1/meta/_drafts` from one recording router that fails on any other url, instead
of a blanket `fetch` sink that answered every url with the runtime-config body
(objectui#8033). Their teardown also calls RTL `cleanup()` before `vi.unstubAllGlobals()`,
so the real `fetch` is never back in place while the tree is still mounted
(objectui#7439). All four stub sites across the two files are converted. `_drafts` answers
an empty ledger, which is what `PendingDraftsBanner` already rendered from the failed read,
so no assertion moves. No published behaviour changes — no product source is touched.
