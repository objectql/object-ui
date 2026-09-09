---
---

Internal tooling only — no package changes, so this changeset declares no release.

Adds `pnpm census:cross-file-line-citations`
(`scripts/cross-file-line-citation-census.mjs`), the tree-wide measurement
objectui#8875 asked for and nothing else. objectui#7853 ruled that an assertion
is cited by CONTENT, not by line address; objectui#8047 mechanized that ruling
for test names only, carving out comments and failure messages because "a human
reads them beside the code they annotate". objectui#8875 observes that the
justification holds for a same-file citation and not for a cross-file one, and
says the choice between the three possible remedies "needs the tree-wide
population that has not been measured".

This is that measurement. It is report-only, deliberately named `census:*`
rather than `check:*` — the two existing `census:*` scripts appear in no
workflow, so the name is how this stays out of CI without a reader having to
take it on trust. It repairs nothing: objectui#8875 reserves that decision, and
records why, since shifting an already-false address by a hunk delta moves a
wrong pointer to a differently wrong place while making the diff look diligent.

The census reads all five spellings the card named — the `path:line` form, the
`#L` permalink, the address written before or after the file name, and the bare
continuation address that carries no filename and that no basename-anchored
probe can match. It carves out released changelog sections, because a changelog
entry is a dated record of what was true at that release. It judges each
citation against what is at the cited line TODAY, never against whether a recent
diff moved it. Two controls run on every invocation and are fatal: a known-false
citation that must be reported, and a verified-correct one that must not.

`scripts/__tests__/cross-file-line-citation-census.test.ts` pins the syntaxes,
the verdict rules and the carve-outs.
