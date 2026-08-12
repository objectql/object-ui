---
'@object-ui/plugin-grid': patch
---

standalone ObjectGrid resolves off-spec `rowHeight` to compact, matching ListView and the spec bridge, instead of silently styling it as medium

One component answered one question two ways. `ObjectGrid` seeded its density state with `schema.rowHeight ?? 'compact'`, so an ABSENT `rowHeight` landed on `compact` while an OFF-SPEC one skipped every arm of the density ternaries and came out at their terminal `else` — the `medium` styling. That is the absent-vs-off-spec split objectui#4440 removed from `ListView`, and it made a standalone grid the third answer to a question the rest of the system had already settled: `@object-ui/core`'s `rowHeightToDensityMode` abstains for an off-spec value, the `@object-ui/react` spec bridge abstains, and `ListView` defaults the abstention to `compact`. Off-spec now renders exactly like absent, everywhere.

Only a standalone grid was affected. When `ListView` owns the grid it overwrites the prop with a value derived from `density.mode`, so nothing off-spec survives that hop.

The narrowing happens at the state boundary, not in the ternaries. `medium` is still a real row height with its own styling arm, and a leaf renderer's terminal `else` is still legitimate styling — what changes is that nothing unrecognized can reach it. Membership is tested against `ROW_HEIGHT_TO_DENSITY_MODE`, so the admitted values keep one definition in the repo and the build fails if the spec grows a sixth row height without teaching the resolver about it. Both entry points go through the resolver: the initial state and the effect that re-syncs when the `rowHeight` prop changes.

Two off-spec spellings behaved differently before this, which the report of the defect did not distinguish, and the boundary fix covers both:

- A plain off-spec value (`'garbage'`) was not a key of the toolbar's row-height icon map either. That map is looked up by the same unvalidated state, so `rowHeightIcons[mode]` was `undefined` and rendering `<RowHeightIcon />` threw `Element type is invalid` — a standalone grid with an off-spec `rowHeight` did not render at all, rather than rendering as `medium`. The toolbar is shown precisely when `schema.rowHeight` is defined, so the crash and the off-spec case coincide exactly.
- A prototype member (`'toString'`) WAS reachable through that map's prototype chain, resolving to `Object.prototype.toString` — a function, which React accepts as a component — so it survived to the ternaries and rendered as `medium`, the defect as filed. The resolver uses `hasOwnProperty` rather than `in` for this reason, the same reason `@object-ui/core` does.

Both are now inert: the state can only ever hold one of the five admitted row heights, so the icon lookup is total and the ternaries never fall through.
