---
'@object-ui/plugin-detail': patch
'@object-ui/types': patch
---

`record:details` — implement the `sections[].group` reference form, stop one
section taking its siblings down, and resolve enumerated field labels through
the object's declared `label` (objectui#8497).

**An authored `{ group: 'parties' }` used to blank the whole record page.**
`@objectstack/spec` 17.3.0 declares the group-reference form in full
(`RecordDetailsProps.sections[].group`, objectstack#13855, ADR-0085 §5), but
this renderer read the key nowhere, and its own props description told authors
so. That was not a no-op: a section carrying `group` carries no `fields`,
`DetailView` mapped every section through `s.fields` unguarded, and `flatMap`
kept the resulting `undefined` as an element whose `.name` the next line read.
The throw arrived with `e99770841` (2026-05-01), months before the key it
fires on was declared, so it was never a deliberate refusal — the declaration
was right and the runtime had never honoured it. `group` is now resolved
through `deriveFieldGroupDetailSections`, the same adapter the synthesized
default record page uses, so the group-referenced body and an equivalent
enumerated body render identically. A `group` naming no declared group renders
nothing and says so on the console (`@objectstack/lint` reports it as
`page-section-group-unknown`); it is no longer silent, and it no longer throws.

**A malformed section now degrades to that section.** Two layers, because one
is not enough: the field-collecting reads are tolerant of a section with no
`fields` array (the crash above fired in a `useMemo` above the section loop,
where no boundary could reach it), and each section is additionally wrapped in
the per-section error boundary, so a section that throws while rendering shows
the failure in its own place instead of replacing the whole component.

**Enumerated field labels reach the object's declared `label`.** The ladder is
`i18n bundle key -> the object's declared label -> the field name`. Rung 2 was
missing, so an app with no translations configured showed raw snake_case field
names on every detail page. An authored entry `label` still wins, and an app
with a full bundle is unchanged.
