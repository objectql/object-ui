---
'@object-ui/plugin-tree': patch
---

`ObjectTree` derives expansion during render instead of mirroring it into state
(objectui#8666).

**The rendering artifact this removes.** Expansion lived in a
`useState<Set<string>>(new Set())` that a passive `useEffect` keyed on
`[roots, defaultExpandedDepth]` re-seeded from the forest, with rows computed as
`flattenVisible(roots, expanded)`. So the commit that first painted the table
still carried the previous, empty mirror: the root drew, its children did not,
and a second commit drew the seeded-open forest. Probed in the DOM the sequence
was `loading` then a one-row table then a two-row table; it is now `loading` then
the two-row table. Every mount with a non-zero `defaultExpandedDepth` showed a
collapsed forest for one frame, and that frame is also why a test could observe a
half-drawn tree at all.

**The behaviour change that comes with it, and it is the load-bearing half.**
Component state now holds only the answers the *user* gave by clicking a chevron
— a sparse map of node id to open/closed — and the seed is computed from the
forest during render. They compose by one rule: a new forest may re-seed, but a
node the user deliberately opened or closed, and which is still in the forest,
keeps the user's answer; every other node, a genuinely new one included, takes
the seed.

That is a fix in the same direction as the frame, not a side effect of it.
Before this change a re-seed *overwrote* the user's expansion, so any change to
the identity of the record set — a refetch, a filter, a host re-render that
reallocated the rows — silently reopened every subtree the user had collapsed
and reclosed every one they had opened below `defaultExpandedDepth`. Authored
metadata is unaffected: `defaultExpandedDepth` means exactly what it meant, and
no schema key changes.
