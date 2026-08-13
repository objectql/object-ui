---
'@object-ui/plugin-grid': patch
---

ObjectGrid's record-detail date fallback follows the display locale
(objectui#4541).

`renderRecordDetail`'s type-inference fallback rendered date-like values with
a bare `formatDate(value)` — no options at all. `formatDate` then handed `Intl`
an `undefined` tag, and `undefined` is not "the user's locale", it is the
**machine's**, which is neither of the repo's two locale channels. On a `zh`
console that one cell rendered `Mar 15, 2024` while every neighbouring date
cell rendered `2024年3月15日`.

This was the third `formatDate` site in the file. objectui#4272 (PR #4544)
ruled its plugin-grid surface to "ONLY the two date-cell call sites" — the two
that pass `'short'` in the mobile card view — and this one was never among
them, so it was filed rather than fixed there.

The fix is pure consumption, not plumbing: the component already reads
`useDisplayLocale()` at component level (landed in PR #4544), and
`renderRecordDetail` is a plain arrow in the component body that already closes
over `tenantCurrency` from that same scope, so the call site simply gains
`{ locale: displayLocale }`. No hook was added, and the function is not
memoized, so there is no dependency array to keep in step.

One resolver everywhere, as before: `useDisplayLocale()` (tenant regional
default → active UI language → `'en'`). English output is byte-identical — the
runner's `en-US` and `en` agree on this branch — and the two `'short'` cells
PR #4544 threaded are untouched.

`patch` rather than `minor`: the package's own `.d.ts` files are byte-identical
across the change, so this is module-local (the objectui#4496 precedent).
