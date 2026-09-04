---
'@object-ui/i18n': patch
---

`dashboard.noRows` and `dashboard.noDataAvailable` are retired — two rows removed from
each of the ten locale packs, 20 entries, zero readers (objectui#7125).

objectui#7063 routed the three dashboard empty-state renders (`DatasetWidget`,
`ObjectDataTable`, `PivotTable`) through one shared `WidgetEmptyState`, which resolves its
own copy from the `dashboard.empty.*` family. The two keys the old per-widget placeholders
used outlived their call sites in `packages/i18n/src/locales/{en,de,es,fr,pt,ru,ja,ko,zh,ar}.ts`.

Removed under objectui#4658's evidence standard, re-measured on this branch rather than
inherited from the card: zero `t()`/`tt()` call sites for either fully qualified key, no
dynamic `dashboard.` head a substitution could resolve onto them, and every surviving
textual occurrence in `packages/` is a comment recording the consolidation. `pnpm
check:i18n-keys` stays green across the deletion with the `en` pack at 2,962 keys (2,964
before) and every in-scope call-site key still resolving.

Not touched: `table.noRows` (`'No rows to display'`) and `engine.form.noRows`
(`packages/app-shell/src/views/metadata-admin/i18n.ts`, read at `widgets.tsx`) — two
different, same-named keys in different namespaces. Nor the comments in
`WidgetEmptyState.tsx`, `DatasetWidget.tsx`, `ObjectDataTable.tsx` and `PivotTable.tsx`
that record WHY three widgets with three strings became one shared empty state; the packs'
own comment keeps that rationale and now names the retirement instead of a row that is
gone.

`packages/i18n/src/__tests__/dashboard-emptyState-keys-retired-7125.test.ts` pins the removal
by name, following the five prior retirements (objectui#4145, objectui#4392, objectui#4730,
objectui#5504, objectui#6310). Every i18n gate here runs call site → key, so none of them can
see a dead key come BACK into the packs: the reverse sweep that found these is report-only by
design, `all-locales-key-parity` is fully satisfied by ten packs agreeing on a dead key, and
`check:i18n-drift` reported the deletion as `2 removed — those are all-locales-key-parity's`.
