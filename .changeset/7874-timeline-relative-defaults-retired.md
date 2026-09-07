---
---

Internal residue removal, no published behaviour: the five `timeline.relative.*`
rows are deleted from `TIMELINE_DEFAULT_TRANSLATIONS`
(`packages/plugin-timeline/src/useTimelineTranslation.ts`), and a retirement pin
replaces them.

The rows, transcribed verbatim because that — not "it is in git history
somewhere" — is what makes the deletion reversible:

```ts
'timeline.relative.today': 'Today',
'timeline.relative.tomorrow': 'Tomorrow',
'timeline.relative.yesterday': 'Yesterday',
'timeline.relative.inDays': 'In {{n}} days',
'timeline.relative.daysAgo': '{{n}} days ago',
```

Nothing releases because nothing could reach them. The `en` pack defines no
`timeline.relative.*` leaf, so the provider path never served one; no call site
anywhere in the tree — sources, tests, JSON, ignored build outputs — asks for the
prefix `timeline.relative`, so the provider-less `fallbackT` never reached a row
either; and neither `TIMELINE_DEFAULT_TRANSLATIONS` nor `translateTimelineDefault`
is re-exported from the package entry, so no consumer of the tarball can name
them. Day-granularity relative phrases are produced by `formatRelativeDate` in
`@object-ui/core` through `Intl.RelativeTimeFormat`, which needs no copy row —
that is what left these five behind (objectui#7874, found by objectui#7567's
factory-default census printing its abstention count).
