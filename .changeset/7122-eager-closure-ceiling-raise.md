---
---

Raise the console eager-closure ceiling once, on explicit maintainer
authorisation, to the measured cost of `@objectstack/spec` 17.3.0
(objectui#7122). Tooling only; no package is released by this change.

Raising a gate ceiling is a gate weakening and sits on the manual floor, so it
is a human's decision. The authorisation, verbatim:

    维护者 sam@objectstack.ai 于本轮明确授权：「抬上限，把 7685 弄绿」

recorded on objectui#7122 as decision batch 1 item 1 = "B + A": a one-time,
cause-recorded adjustment of exactly the measured delta, with the upstream card
filed alongside it.

**What the bytes buy — this is NOT routine growth.** The residue is
`@objectstack/spec` 17.3.0's own browser-dist growth: +292.2 KB gzip on the spec
package alone, whose measured mechanism is that 17.3.0 lengthened the Zod
`.describe()` doc strings shipped in the browser build. It is authoring
documentation prose, delivered on every page load.

**It is not duplication.** That was the larger, separate problem and it is
already fixed: resolving the spec alone to 17.3.0 shipped two copies of it, and
moving the family together in the lockfile collapsed that (−671 KB; markers
unique to 17.2.0 fell from 92.3% to 1.0% of 104, the single survivor accounted
for). No chunk entered or left the closure and the eager chunk count is
unchanged.

**The honest long-term fix is upstream**, and this ceiling is the marker for it
rather than the answer to it: a `describe()`-stripped browser build returns
~292 KB to every consumer of the spec, not just this console. Filed as
objectstack#16063, and recorded in the gate as the restore condition — when it
lands, re-measure and bring the ceiling and its baseline back down together.

Four constants move as two ceiling/baseline pairs, measured by `pnpm build`
(exit 0, 43/43) on `34a1578ef`:

| constant | from | to | headroom vs the 91,136-byte regression |
|---|---|---|---|
| `MAX_EAGER_CLOSURE_GZIP_BYTES` | 3,268,000 | 3,597,000 | 45,809 = 0.50x |
| `BASELINE.gzipBytes` | 3,222,314 | 3,551,191 | — |
| `PER_CHUNK_GZIP_CEILINGS['vendor-objectstack']` | 967,000 | 1,254,000 | 18,971 = 0.21x |
| `PER_CHUNK_BASELINE['vendor-objectstack']` | 948,461 | 1,235,029 | — |

Both ratios match the proportions the retiring pairs carried (0.50x and 0.20x),
so the gate keeps failing on a repeat of the 89 KiB regression that motivated
it. No other exemption was added, no import was made lazy, and the three
per-chunk lines that still pass — `i18n-locales`, `framework`, `ui-components` —
were left exactly as they are.
