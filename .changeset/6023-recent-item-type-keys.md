---
'@object-ui/i18n': patch
---

All ten locale packs now define `home.recentApps.itemType.report` and
`home.recentApps.itemType.metadata` (objectui#6023). `RecentItem['type']` is a six-member
union and `useTrackRouteAsRecent` writes both of these at runtime — `metadata` on any
`/metadata/<type>/<name>` route visit, `report` on any `/report/<name>` visit — but the
packs defined only four of the six, so the Recently Accessed and Starred cards labelled
those two items from the call sites' inline `defaultValue` instead of from the pack.

Ten packs missing the same member is full parity, so no pack-vs-pack gate could see it,
and the prefix rule only ever asked whether `home.recentApps.itemType` resolved, which it
did. What made it quiet rather than loud is the `defaultValue`: English readers saw a
plausible `Report` / `Metadata` (lowercase in the rail) rather than a raw key, and the
other nine locales saw those English words — objectui#3517's mechanism for hiding a
missing key for months.

The nine translations were taken from each pack's own existing rendering of the same word
rather than composed: the singular `Report` that `appDesigner.navReport`,
`appDesigner.navTypeReport` and `search.badgeReport` already carry (ar `تقرير`, de
`Bericht`, es `Informe`, fr `Rapport`, ja `レポート`, ko `보고서`, pt `Relatório`, ru
`Отчёт`, zh `报表`), and the `Metadata` that `layout.metadata.label` already carries (ar
`البيانات الوصفية`, de `Metadaten`, es `Metadatos`, fr `Métadonnées`, ja `メタデータ`, ko
`메타데이터`, pt `Metadados`, ru `Метаданные`, zh `元数据`). No new vocabulary was invented
for any locale.

The two matching entries in `scripts/i18n-call-site-key-baseline.json`'s `missingMembers`
are cleared, since that list is a ratchet: a baselined entry whose defect is gone fails the
build too. The union itself is untouched — narrowing `RecentItem['type']` is the other
resolution the gate accepts, and it would have been a lie about data both call sites
demonstrably write.
