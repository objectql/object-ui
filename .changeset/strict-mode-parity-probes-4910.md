---
---

Test-only (objectui#4910). The two `element:*` spec-parity tests in
`packages/components/src/__tests__/` — `text-input-inputs-spec-parity.test.ts` and
`record-picker-inputs-spec-parity.test.ts` — re-express their undeclared-key contrast probe
so it holds on both `@objectstack/spec` pins.

`@objectstack/spec@17.0.0` GA flipped the `element:*` props schemas from strip mode to
strict (objectstack#4001 batch A): an undeclared prop used to parse green and vanish from
`data`, and now fails with `unrecognized_keys` naming the key. Each probe existed to keep
the surrounding key-reachability claim non-vacuous — it shows what an *unpublished* key
looks like, so "the declared key survives the parse" means something — and it asserted the
strip-mode half as its control, which GA falsifies.

Both probes now read the installed spec's refusal mode **behaviourally** (parse a payload
carrying a key no spec declares) and assert the same verdict under either mode: a named
`unrecognized_keys` refusal under GA, a silent drop under the pinned `17.0.0-rc.6`. Neither
arm is vacuous, and the probe never reads a version string, so it cannot go stale against a
pin it does not observe. The undeclared key is now carried alongside the declared one, which
is what makes either arm attributable to the undeclared key rather than to the declared key
having gone bad. This is the disposition already taken by
`packages/plugin-detail/src/__tests__/recordHighlightsInputs.spec-parity.test.ts`
(objectui#4648 / PR #4671).

No published behaviour changes: no runtime source, no registration, and no gate was touched
— only the two test files.
