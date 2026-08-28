---
'@object-ui/i18n': patch
---

`ar` spells the منقوص participle one way — `جارٍ`, pack-wide (objectui#6610).

The pack wrote the active participle of جرى two ways at once: `جارٍ` on 92
values and `جاري` on 8. One word, two spellings, differing by a single code
point — U+064D (tanwīn kasr, the yāʾ dropped) against U+064A (the yāʾ kept) —
and same-screen visible: `LoadingScreen` renders `console.initializing` as the
heading over the three `console.loadingSteps.*` and `console.actions.retrying`
on the retry button, four values that all said `جاري`, inside a console that had
already said `جارٍ` on `dashboard.loading`, `list.loading`,
`detail.loadingAttachments` and `console.ai.*`.

The 92:8 majority is not why the 8 moved. An اسم منقوص declines three ways, so
"the 8 are right in their own context" was a live reading and was falsified
rather than out-voted: all eight opened their string as a fronted indefinite
predicate over a delayed subject — nominative, indefinite, not annexed — and
five had a word-for-word twin already spelled `جارٍ`, `grid.refreshing`
(`جاري التحديث…`) against `list.refreshing` (`جارٍ التحديث…`) being the exact
minimal pair. Meanwhile the three values where the yāʾ is grammatically required
(accusative `جاريًا` after لا يزال / ما زال, definite `الجارية`) are correct and
are left alone.

Eight values converged; no key added or removed and no `en` value touched.
`ar-participle-orthography-6610.test.ts` makes it a pack-wide invariant rather
than an eight-key edit — a ninth value arriving with the yāʾ now fails by key
name — and pins the three legitimate yāʾ occurrences so a later sweep cannot
flatten a correct distinction into a real grammatical error.
