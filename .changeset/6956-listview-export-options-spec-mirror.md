---
'@object-ui/types': minor
---

**Breaking for authored metadata:** the `exportOptions` member of the ListView
zod mirror (`ListViewSchema` in `@object-ui/types/zod`) is now `@objectstack/spec`'s
own `ListViewSchema.shape.exportOptions`, bound by reference rather than
restated (objectui#6956). A `list-view` document that authors the retired `'pdf'`
format — in either spelling, `exportOptions: ['csv', 'pdf']` or
`exportOptions: { formats: ['pdf'] }` — or a sixth key on the object form
(`{ formats: ['csv'], compression: 'gzip' }`) no longer validates through this
package's mirror. It never validated at the platform's publish gate:
`@objectstack/spec` 17.0.0 removed `'pdf'` from the format enum (objectstack#8010;
PDF export itself was declined as objectstack#1301 NOT_PLANNED) and made the
object form strict, so the mirror was passing locally what the platform refuses
with an `os migrate meta --from 16` prescription — an author saw green here and
a refusal upstream. `streaming`, the fifth spec key, is now declared on this face
(the renderer honoured it; no local declaration carried it).

**What was measured, on this branch's base.** The mirror declared a pre-#8010
shape of its own — `'pdf'` in both branches, no `streaming`, a non-strict
`z.object` — and `ListViewInferred` is `z.input` of that mirror, so the
`ListViewSchema` TYPE the ListView renderer is written against disagreed with
its sibling `ObjectGridSchema['exportOptions']` (the clean five-key
`ListViewExportOptions`), and the renderer could only read `streaming` through
`as any`. Against the installed pin (`@objectstack/spec@17.2.0`, not a working
tree), `ListViewSchema.shape.exportOptions` from `@objectstack/spec/ui` lifts
`['csv', 'xlsx']` to `{ formats: ['csv', 'xlsx'] }`, refuses `['csv', 'pdf']`
with the migration prescription, refuses `{ formats: ['csv'], compression: 'gzip' }`
(strict), and accepts `{ formats: ['csv'], streaming: true }` with the value
intact. The mirror now IS that schema object, so the four verdicts are the
spec's by construction; `export-options-spec-parity.test.ts` pins the identity,
the four verdicts, and the survival of `streaming` through a parse.

**The TS face follows.** `ListViewSchema['exportOptions']` is now the spec's
INPUT type: `ListViewExportFormat[] | ListViewExportOptions` — the bare array
stays admissible on input because nothing on the render path parses, and the
object arm IS the same `ListViewExportOptions` that `ObjectGridSchema` and
`NamedListView` carry. One spec key, one type, on every local authoring surface;
`'pdf'` is a compile-time refusal in both spellings.

**Who is NOT affected.** A document authoring `['csv', 'xlsx']`,
`{ formats: ['csv', 'json'] }` or any combination of the five spec keys is
untouched; absent stays valid; the member's description is now the spec's own
text. The spec's parse-time lift of a bare array to `{ formats }` now runs for
whoever parses through this mirror as well.

**Migration:** delete `'pdf'` (the surviving formats are `'csv'`, `'xlsx'` and
`'json'`); delete any key outside `formats` / `maxRecords` / `includeHeaders` /
`fileNamePrefix` / `streaming`. `os migrate meta --from 16` lists the mechanical
edits for existing sources.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated value. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
