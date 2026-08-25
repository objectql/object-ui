---
'@object-ui/plugin-gantt': patch
---

`ObjectGantt`'s export filename resolves a locale-map `label` instead of stringifying it
(objectui#6052). A gantt authored as
`{ "type": "object-gantt", "objectName": "task", "label": { "en": "Shift Plan", "zh-CN": "排班计划" } }`
exported its PNG/PDF as `[object Object]-20260825-1030.png`.

`BaseSchema.label` is `string | I18nLabel` since #4580's revised Q1-A ruling — `I18nLabel`
being the spec's INLINE locale MAP — and the `exportFileName` chain handed that value
straight to `String(...)`. It now goes through `resolveI18nLabel` from `@objectstack/spec/ui`,
the producer's own resolver for that vocabulary, against the display locale the file already
reads via `useDisplayLocale()`. A zh-CN audience gets `排班计划-<stamp>.png`, an en audience
`Shift Plan-<stamp>.png`, and a plain-string label is unchanged.

The next link in the same chain, `objectSchema?.label`, is deliberately left alone: that is
the DATA object's label, declared `z.string().optional()` on the spec's `ObjectSchemaBase`,
which is a `strictObject` — a locale map there is rejected by the producer rather than
resolved by the consumer, and wrapping it would be accepting a second vocabulary at a read
site. No filename sanitisation is added either; `GanttView` already strips
filesystem-hostile characters downstream, and a resolved map entry goes through the same
strip a plain string does.
