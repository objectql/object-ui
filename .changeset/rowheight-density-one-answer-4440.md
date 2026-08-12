---
'@object-ui/core': minor
'@object-ui/plugin-list': minor
---

`rowHeightToDensityMode` answers only for the five spec row heights — the coerce-to-`comfortable` fallback is gone

Two surfaces narrow a list view's `rowHeight` onto the renderer's three-step
density vocabulary, and since objectui#4352 they answered differently for the
same off-spec input: `@object-ui/react`'s spec bridge declined to answer, while
`@object-ui/core`'s `rowHeightToDensityMode` rehabilitated anything unknown into
`comfortable`. One metadata-driven system, two answers for one input
(objectui#4440).

The strict answer wins, per AGENTS.md #0.1: a renderer-side rehabilitation of
off-spec metadata is a second de-facto contract, and one strict contract beats N
dialects — a bad `rowHeight` gets fixed at the producer, where the schema already
rejects it. The five mappings themselves are untouched (`compact`/`short` →
`compact`, `medium` → `comfortable`, `tall`/`extra_tall` → `spacious`), and the
table keeps its `Record< RowHeight, … >` typing, so a row height added upstream
still fails the build here.

**Breaking semantics, deliberately graded `minor`** (this repo never publishes
`major` — its major tracks `@objectstack`). Two things change:

- **Published type.** `rowHeightToDensityMode` is exported from
  `@object-ui/core`, and its return widens from `DensityMode` to
  `DensityMode | undefined`. A host assigning the result straight into a
  `DensityMode` now has to say what an off-spec row height should mean to it.
- **Rendered output, for input the spec already rejects.** `ListView` — the one
  in-repo caller — used to render an off-spec `rowHeight` one step looser than an
  ABSENT one (`comfortable`, 40px rows, vs `compact`, 32px). It now renders it
  exactly like an absent one, `compact`, which is also `ObjectGrid`'s own default.
  A sweep of this repo, the `objectstack` example apps and one downstream app
  found zero authored off-spec values, and the legacy `densityMode` alias cannot
  produce one (`DENSITY_MODE_TO_ROW_HEIGHT` is typed
  `Record< DensityMode, RowHeight >`).

Also closed while retiring the branch: the lookup guarded membership with `in`,
which walks the prototype chain, so `rowHeight: 'toString'` returned
`Object.prototype.toString` — a function — from something typed `DensityMode`. It
is an own-property check now.
