---
---

Test-only (objectui#6823): the console deprecation notice and the machine-readable
`deprecated.replacement` a deprecated type declares are now asserted to offer the same
set of replacement types, one case per renderer (`div`, `span`).

Since objectui#6674 a deprecated type's migration guidance is stated twice — the notice
string literal in the renderer, and the `deprecated.replacement` on its registration,
transcribed from the notice by hand. Nothing held them together, so a reword of either
left the other stale, and the stale copy is the one an automated gate reads and repeats
to authors. There is no `tsc` here to notice one string literal drifting from another.

`packages/components/src/__tests__/deprecation-guidance-agreement.test.tsx` extracts the
double-quoted type names from each side — the notice's guidance BULLETS, and the
declaration's replacement line — and asserts set equality. Nothing about the guidance
text is restated in the test; a third copy of the sentence is the defect one layer up,
and per triage it is the signal to stop rather than the way to write this.

Shape ruled by triage (2026-08-29): assert the agreement, do not converge the two texts.
The notice wording is pinned byte-for-byte by four existing tests, and those pins are
themselves objectui#4000's ruling — converging would trade one ruled invariant for
another. No pin is touched here, and no published behaviour changes.
