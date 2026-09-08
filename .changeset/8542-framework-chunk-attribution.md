---
---

Record the measured attribution for the `framework` per-chunk overage in
`scripts/check-eager-closure-budget.mjs` (objectui#8542). Prose only; no package
is released by this change and no constant moves.

The ceiling raise that landed as `fa9e76ccd` wrote that the bytes behind the red
were `NOTHING IDENTIFIABLE` because "the commits in that window have never been
bisected". They have been now, one `apps/console` build per point from the repo
root, and the finding corrects the framing every filing card carried:

| build       | landed by | `framework` gzip | moved by                 |
| ----------- | --------- | ---------------- | ------------------------ |
| `40a7c538a` | #8503     | 70,999           | last GREEN, 1 byte under |
| `512c84b16` | #8519     | 70,999           | 0                        |
| `f76f43628` | #8512     | 71,261           | +262                     |
| `e76634cc8` | #8529     | 72,245           | +984                     |
| `e411c3e58` | #8562     | 72,248           | +3                       |

Two commits own the overage, not one, and the larger is **outside** the window
the cards bisected: `e76634cc8` carries 984 of the 1,246 bytes the pair added.
`270f2825b`, the suspect objectui#8541 named, is measurably innocent — the
emitted chunk is byte-identical across it and it touches no file under
`packages/(core|react|types)`.

Both contributors are silent-wrong-answer fixes on one file's filter path, so
what the bytes buy is now stated where the gate's failure message asks for it.
