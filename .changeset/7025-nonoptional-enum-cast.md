---
---

Internal test-only change, no user-visible behaviour (objectui#7025).

The SIXTH spelling of the Zod-internals reader hazard objectui#5872 catalogues:
9 spec-parity test files in 7 packages cast an enum node NON-optionally to an
options-bearing shape and read `.options` straight off it. They converge onto
`@object-ui/test-support`'s `enumOptions(node)` — the same walk objectui#6924
converged the optional-cast family onto in PR #7024.

Unlike that family, these sites failed LOUDLY (spreading `undefined` throws), and
the shared reader deliberately answers `[]` rather than raising. So every site
keeps its own non-vacuity duty: a throwing wrapper at the seven module-scope
reads, and the suite's own pre-existing non-vacuity assertion at the two in-test
reads. A bare conversion would have traded a loud failure for a silent empty
vocabulary — a regression, not a convergence.

Only test files, two `devDependencies` edges and the lockfile change; no
package's shipped `dist/` and no public type moves.
