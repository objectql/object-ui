---
'@object-ui/plugin-list': minor
'@object-ui/plugin-view': minor
---

Gantt views no longer hand the renderer invented `progress` / `dependencies`
field names (objectui#7499).

Flavour 3 of objectui#7070 — the half its 2026-09-01 ruling ordered carded
separately and judged on its own terms, ⛔ explicitly forbidding the date-axis
conclusion from being imported. Two faces floored the pair, and app-shell
carries neither key (measured: `|| 'progress'` counts 0 there; the control that
the zero is not a dead probe is that app-shell *does* floor `titleField` at
`'name'`):

- `plugin-list/src/ListView.tsx` — the `object-gantt` render branch.
- `plugin-view/src/ObjectView.tsx` — `generateViewSchema`, the authored
  `object-view` element route, which bypasses `ListView` entirely.

**The remedy is OMIT, not refuse — and the asymmetry against the date axis is
exactly why the date-axis conclusion must not be imported.** A fabricated date
axis has no legitimate twin: every bar lands on a column nobody declared, a
whole-chart error, so refusal is right there. A fabricated `progress` /
`dependencies` name yields a per-row `undefined`, which is indistinguishable
from the legitimate and common case — most gantt rows have neither. Refusing
would break that common case; fabricating manufactured a binding the author
never wrote, whose failure was silent. Omission does neither.

**What changes for an author.** A view that declares neither `progressField`
nor `dependenciesField` now passes a config carrying neither key, instead of
`'progress'` / `'dependencies'`. A view that declares one passes the author's
value verbatim, exactly as before, through both the spec-canonical `gantt`
block and the legacy `options.gantt` nesting.

The only population whose behaviour actually changes is a schema carrying a
column literally named `progress` or `dependencies` while NOT declaring the
corresponding field key — those worked by accident, because the floor happened
to match the column name. That population was measured across `examples/`,
`content/docs/**`, the `packages/*/src` fixtures and all 528 JSON/YAML metadata
files before anything was deleted: it is **empty**. The census and its
blind-spot reading are in the PR.

Nothing about the refusal screen moves: `ObjectGantt.getGanttConfig` gates on
the two date fields alone, so deleting this pair cannot resurrect a config —
`plugin-gantt/src/ObjectGantt.unconfiguredRefusal-7070.test.tsx` is the
non-regression control and stays green.

⚠️ One consequence worth recording for objectui#6470, which is NOT touched
here. `getGanttConfig`'s flat branch reads
`schema.dependenciesField || schema.dependencyField`. While the floor was in
place, `dependenciesField` was always truthy through these two faces, so the
declared legacy singular alias `dependencyField` was unreachable via them —
shadowed, not read. With the floor gone, a view that wrote `dependencyField`
now resolves through the alias limb as its `@deprecated` contract already
promises. No in-repo view declares it (measured: zero sites at either routed
face), and the alias's own deprecation and retirement remain objectui#6470's
question, deliberately left alone.
