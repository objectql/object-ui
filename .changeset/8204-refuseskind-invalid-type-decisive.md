---
---

Test-only change: repair the `registry-inputs-spec-parity` kind classifier so a member
whose contract is a `z.union` is judged by what the union actually refused. No published
behaviour changes; nothing outside `apps/console/src/__tests__/` is touched.

objectui#8204. `refusesKind` asked "is EVERY complaint at this node a kind complaint",
and Zod keeps running a schema's checks after its type check has failed: for
`z.string().min(1)` the probe `[]` comes back as both `invalid_type` AND `too_small`.
Read by `every`, that pair is a CONTENT refusal — so the array probe that
`@objectstack/spec` 17.3.0's `RecordActivityProps.types`
(`z.array(z.union([FeedItemType, z.string().min(1)]))`) measurably refuses put `array`
into that key's accepted kind set, and the derivation gate reported
`record:activity.types → contract accepts {string,array}` for a key whose array members
the contract rejects.

`invalid_type` at a node is now decisive: a value cannot be simultaneously the right kind
and the wrong one, so whatever else the node says about a value it has already refused
for its kind is downstream of that refusal, not a second opinion. Measured against the
installed 17.3.0 artifact, `record:activity.types` goes `{string,array}` to `{string}`
and no other judged key moves; `record:highlights.fields`, a genuine member union, is
still reported as `{string,object}`.

The suspected mechanism "`refusesKind` does not recurse into `z.union`" was measured and
is FALSE — the recursion runs and is what carries branch verdicts up. The per-branch
reading underneath it was the defect.
