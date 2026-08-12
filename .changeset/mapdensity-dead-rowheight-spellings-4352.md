---
'@object-ui/react': minor
---

`bridgeListView` maps the five row heights the spec admits, and only those — the four dead spellings are gone

`mapDensity` carried a nine-key table: `compact`, `short`, `comfortable`,
`spacious`, `small`, `medium`, `large`, `tall`, `extra_tall`. `RowHeightSchema`
in `@objectstack/spec` admits five — `short | compact | medium | tall |
extra_tall` — so `comfortable`, `spacious`, `small` and `large` were unreachable
from any spec-valid list view. The bridge's own parameter type said as much
(`Partial< ListView >`), and `mapDensity` widened it back to `rowHeight?: string`
to let them in. They survived because the fixture asserting three of them
compiled against nothing: the package's build tsconfig excludes tests and no
other `tsc` read them, so four branches of renderer-side dialect read as live
capability (objectui#4352, surfaced by objectui#4040 / PR #4351).

They are deleted. The parameter takes the spec type honestly, and the table is
now `Record< RowHeight, … >`, so a row height added upstream fails the build here
instead of arriving with no density. This is AGENTS.md #0.1: a lenient reading
for off-spec metadata is a second de-facto contract, and one strict contract
beats N dialects — a bad `rowHeight` gets fixed at the producer, where the schema
already rejects it.

**Breaking semantics, deliberately graded `minor`** (this repo never publishes
`major` — its major tracks `@objectstack`). Nothing narrows in the published type
surface: `mapDensity` is module-local and never appeared in the emitted `.d.ts`,
and `bridgeListView`'s declaration is unchanged. What changes is runtime output,
and only for input the spec already rejects: a host handing the bridge
`rowHeight: 'comfortable'` (or `'spacious'` / `'small'` / `'large'`) used to get
`density: 'comfortable'` / `'spacious'` / `'compact'` back, and now gets no
`density` key at all, so the renderer's own default applies. A sweep of this repo,
the `objectstack` example apps and the console's view metadata found zero authored
uses of any of the four; the legacy `densityMode` alias cannot produce one either,
since `DENSITY_MODE_TO_ROW_HEIGHT` is typed `Record< DensityMode, RowHeight >` and
folds onto `compact` / `medium` / `tall`.
