---
---

Build tooling only — the `PER_CHUNK_BASELINE` doc comment in
`scripts/check-eager-closure-budget.mjs`. No constant, no verdict and no test
changed; nothing ships from this change.

The paragraph argued from a reading three aggregate re-baselines old. It said
`BASELINE` "still carries `4c1623c0c`" (it carries `3d257c85a`), did its
arithmetic against the retired 4,005,911 figure, and concluded that the
aggregate ceiling sat far above the payload and that the per-chunk ceilings were
therefore the only lines still holding the three biggest chunks in place. That
conclusion was the reverse of what the same script prints in the same run: a
full console build on `e33b44796` reports the aggregate at 3149.2 KB measured /
3191.4 KB ceiling, headroom 42.2 KB = 0.47x the 89.0 KB regression — in range,
and doing work. An author sizing a re-baseline off the comment would have read
"this half is decorative" at the moment the tool was saying "this half is
working".

Rewritten against that live run. The provenance direction is now stated as
unstable by construction — which side is the later reading flips every time
either is re-baselined, so the comment tells the reader to read the commit names
rather than trusting a direction written in prose. The aggregate-versus-per-chunk
relationship is re-derived and narrowed to what is true: all four ceilings are
inside one regression, and the per-chunk ceilings are the TIGHTER half
(0.21x / 0.08x / 0.04x against the aggregate's 0.47x) that also says WHERE, not
the only half that works. The quoted figures are labelled as one dated run, with
the gate's own printed table named as the answer in force.
