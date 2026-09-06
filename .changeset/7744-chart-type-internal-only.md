---
---

`@object-ui/plugin-charts`: documentation and a pin only — no published behaviour changes.
`normalizeSeries` returns the identical output for the identical input (measured: 336 input
cases, byte-identical JSON before and after; the probe was itself shown sensitive — a reader
reorder moves 49 of those 336).

`normalizeSeries` resolves the per-series family as `str(raw.chartType) ?? str(raw.type)` —
the internal spelling FIRST. `chartType` is the carrier of the renderer's internal `dataKey`
series shape (`ChartRenderer`'s `series?` union declares it on that arm and on no other);
the AUTHORING face refuses it by name via `ChartDataSeriesSchema` (objectui#7694 / PR #7737).
Because the one function normalizes both shapes, an author who skips validation still gets
`chartType` honoured at runtime while the validator refuses that same key — the two faces
disagree.

objectui#7744 ruled that the split is annotated and pinned, NOT retired at the reader:
retiring the limb would change what the internal producers (`DashboardRenderer`, `ObjectView`,
the dataset path) render, which is a reader-side decision of its own. So the limb keeps its
behaviour and gains a docblock that delegates the refusal's rule to where it lives, plus
`chartType-internal-only-7744.test.ts`, which pins the RELATIONSHIP the two files each held
half of: the key the validator refuses is the key the reader prefers. Bringing the faces into
agreement from either side now goes red and names the side that moved.
