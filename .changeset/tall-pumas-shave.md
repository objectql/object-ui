---
'@object-ui/plugin-timeline': patch
---

fix(plugin-timeline): dates follow the active locale instead of a hardcoded en-US

A `zh` console rendered a fully Chinese timeline widget whose axis read
`Aug 11` / `Sep 2026` and whose item dates read `August 11, 2026`
(objectui#4513). `renderer.tsx` handed `Intl` a literal `'en-US'` at four sites
— the hour, day and month gantt headers, and the `long` item date — so nothing
a user or a tenant configured could reach them.

A fifth site was the same defect spelled as an omission: the `short` item date
called `toLocaleDateString()` with no tag at all, which means the *machine's*
locale. It agreed with the other four only by the accident of an en-US runner,
and rendered a third locale on anyone else's machine.

All five now resolve through `useDisplayLocale()` from `@object-ui/i18n`
(tenant regional default → active UI language → `en`) — the one channel every
field, number and currency renderer already uses, converged there in
objectui#4468. The locale is read once in `TimelineRenderer` and threaded into
the two module-level date helpers, which cannot host a hook themselves.

English output is byte-identical at all five sites: `'en'` and the retired
`'en-US'` produce the same forms, and `generateTimeScaleHeaders` gained an
optional trailing `locale` parameter that defaults to `'en'`, so existing
three-argument callers are unaffected. The locale-free header vocabularies
(`Week n`, `Qn YYYY`, `YYYY`) and all non-date rendering are untouched.
