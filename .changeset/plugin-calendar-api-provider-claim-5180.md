---
"@object-ui/plugin-calendar": patch
---

Correct the published "works with the `api` data provider" claim for plugin-calendar,
which `ObjectCalendar` does not implement. `data.provider: 'api'` reaches
`console.warn('API provider not yet implemented for ObjectCalendar')`
(`ObjectCalendar.tsx:294-296`), sets the record set to empty and renders a calendar
with no events; `endpoint` and `method` have no read point anywhere in
`packages/plugin-calendar/src`, and the package never resolves an `ApiDataSource`.

Four publication sites corrected:

- `packages/plugin-calendar/src/ObjectCalendar.tsx:22` (file-header JSDoc): "Works
  with object/api/value data providers" → "Works with object/value data providers".
- `content/docs/plugins/plugin-calendar.mdx:178` (Features list): "Works seamlessly
  with object/api/value data providers" → "Works seamlessly with object/value data
  providers".
- `content/docs/plugins/index.md:168` (Calendar Plugin section): "Works with
  object/api/value providers" → "Works with object/value providers".
- `content/docs/plugins/plugin-calendar.mdx` "API Provider" section: the
  copy-pasteable `provider: 'api'` + `endpoint` + `method` recipe is replaced by a
  statement of the real behaviour, matching the merged plugin-map wording.

The identical sentence published for **plugin-gantt** is left untouched: there
`provider: 'api'` is genuinely implemented (`ObjectGantt.tsx:442-445` resolves a real
`ApiDataSource` through `resolveDataSource`, and `:1155` / `:1495` route write-backs
through it), so the gantt claim is true and this is a shared sentence, not a shared
defect.

Implementing the `api` provider for calendar is capability expansion and is explicitly
out of scope here, the same line objectui#5163 drew for plugin-map. No runtime
behaviour changes: a source comment and docs prose only.
