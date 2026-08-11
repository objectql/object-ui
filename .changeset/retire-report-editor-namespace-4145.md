---
'@object-ui/i18n': minor
---

i18n: retire the orphaned `report.editor.*` namespace — 105 of its 106 keys, in all ten locale packs (~1050 translated strings)

The namespace labelled the hand-rolled report editor form. That form no longer
exists: `ReportConfigPanel`'s body is `ReportDefaultInspector`, a spec-driven
inspector whose labels come from the report spec's own metadata rather than from
a pack namespace. Until objectui#4137 the namespace had exactly one live reader,
and it was the objectui#4118 defect itself — the panel borrowing
`report.editor.title` (the label of the report's Title *field*) to name itself.
Moving that slot onto a purpose-built `report.editor.panelTitle` left the other
105 keys with no reader anywhere.

Re-verified before deleting, repo-wide and per key: no `t()` call site, no
dynamic `t()` template form, and no JSON or MDX reference reads any of the 105.
No user-visible string changes — these keys never rendered.

`report.editor.panelTitle` survives in all ten packs and is untouched; the
deletion sweeps around it. `report.editor` therefore remains a live namespace
holding exactly that one key.

This narrows the exported `TranslationKeys` type (`typeof en`), which is why it
is a minor rather than a patch: code indexing `TranslationKeys` at a retired key
stops type-checking. No runtime consumer existed to break.

A negative pin (`packages/i18n/src/__tests__/report-editor-retired-4145.test.ts`)
names all 105 retired keys and fails if any returns to any pack, since every
existing i18n gate runs call site to key and none of them can see a key with no
call site.
