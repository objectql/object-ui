---
---

CI tooling only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. No package `src/` is touched.

Fixes the comment mask in `scripts/check-node-esm-load.mjs` (objectui#5382). Leg 1 of
the gate blanked comments out of every source with two ordered regexes and then matched
specifiers in the result. The block-comment pass ran first and had no notion of already
being inside a `//` line, so a slash-star sequence occurring in ordinary line-comment
prose — a package glob, a path pattern, a wildcard import, all of them ordinary here —
opened a comment that ran to the next closing delimiter anywhere in the file and blanked
every line between, live code included.

Re-measured on `main` at 478ec54ce over the 805 emitted sources of the 13
specifier-preserving packages: the mask found 2132 relative specifiers and the TypeScript
parser found 2133. The one it could not see is a real `import` in
`packages/app-shell/src/preview/DraftChangesPanel.tsx`, hidden by a line comment naming
the `@objectstack` chunk group by glob two lines above it.

That direction is the bad one. Since `SPECIFIER_DEBT` emptied, leg 1 is a hard
requirement rather than a ratchet, so a blind spot in it is somewhere a regression can
sit permanently while the run reports clean and only the nightly load leg can see the
consequence.

Leg 1 now reads each file exactly as written and takes its module edges from
`check-phantom-dependencies.mjs`'s shared TypeScript scanner — the same one
`check-package-self-import.mjs` uses, so three gates cannot drift apart on what a module
edge is. Comments, strings, template literals and regex literals stop being questions
this gate has an opinion about. Reported line numbers stay the compiler's: the specifier
literal is located inside the statement the parser already identified, which matters
because `tsc` reports this class at the specifier and the statement opens on a different
line for 255 of 2066 relative specifiers here.

The gate's verdict is unchanged — 0 findings before, 0 findings after — because the
newly visible import already carries its `.js` extension. What changed is that it is now
visible. The whole cheap leg went from 0.71s to 2.43s.

`readTsconfig()` in the same script strips comments with the same kind of
context-unaware regex and is a separate live instance of this class. It is deliberately
untouched here and remains open as objectui#5367.
