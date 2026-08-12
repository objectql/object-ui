---
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-report': patch
---

Analytics: a LOCAL select dimension on a table / pivot widget — and on a dataset-bound report — now renders its option label through the locale bundle

A dashboard table grouped by a select field showed `Domestic` on a zh-CN console while the related list on the same screen showed 国内. The value was never untranslated by accident: the server resolves that dimension's display label (ADR-0021) and hands the row over carrying the object's AUTHORED English label. The locale bundle is keyed by the option's stored VALUE (`{ns}.fieldOptions.<object>.<field>.<value>`), so translating one needs the option LIST — and the table path deliberately loaded no object metadata at all, which is why objectui#4030 / PR #4324 fixed charts and dotted dimensions and left this half open.

Table, pivot and the dataset report block now take the one metadata read that gives the bundle something to translate against, and feed it to the SAME seam #4324 landed (`resolveDimensionFieldMeta` → `localizeFieldOptions` / `buildDimensionLabelMap` → `relabelDimensions`). No second resolution dialect: the map carries both the stored value and the authored label as keys, and the relabel is value-wise and idempotent, so a value the server already resolved lands on the same display it would have from the raw value. Cells, pivot headers on both axes, the server's marginal totals, the CSV export and a report's embedded chart all read the one map, which is what keeps a subtotal's bucket lookup meeting the header it belongs to.

Untranslated apps are unchanged by construction: with no bundle entry the display equals the authored label, no key is emitted, and the rows come back by identity. Identity keys stay untranslated — a drilled row or cell still filters records by the values the server sent, and measures still export as bare numbers.

This deliberately amends the acceptance boundary objectui#4263 landed ("a local-only table issues no metadata read"), which was ruled for label RESOLUTION before the read had a second consumer. The pins that stated it are rewritten in place, in the same change, and say so.
