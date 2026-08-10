---
---

Internal test-only gate, no behaviour or authoring-surface change (objectui#3797).

Generalizes PR #3795's single-block `record:highlights` parity check to every
`@objectstack/spec` `ComponentPropsMap` entry this repo registers with a
non-empty `inputs`: a block may not DECLARE a top-level input the spec's props
schema does not accept, with the expectation derived from the spec's own shape at
runtime and every current divergence registered in an explicit exemption list
that carries a reason and a tracking issue per entry.

No package is declared because no published behaviour changed: the four blocks
objectui#3797 flagged (`page:header`, `page:tabs`, `page:accordion`,
`element:record_picker`) keep their `inputs` byte for byte. Per-block verdicts
came out on the spec side, not this one — the keys are read by the renderers and
reachable by authors, so the fix is upstream declaration (objectstack#6776) or,
for `element:record_picker`, already landed upstream in objectstack#5775 and
merely awaiting a `@objectstack/spec` pin bump here. Narrowing them locally would
have deleted live configuration; widening the spec is not this repo's to do
(AGENTS.md #0 / #0.1).

The exemptions expire by themselves: the gate fails on any entry whose key the
spec has since declared, so the pin bump and the upstream landing each force
their own cleanup instead of leaving a permanent allowlist.
