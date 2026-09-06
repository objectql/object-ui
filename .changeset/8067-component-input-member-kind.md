---
'@object-ui/types': minor
'@object-ui/sdui-parser': minor
'@object-ui/components': minor
'@object-ui/plugin-detail': minor
'@object-ui/plugin-grid': minor
---

`ComponentInput.of` — the coarse kind of an input's MEMBERS, with readers on day one
(objectui#8067).

A registration's `type: 'array'` said a value was a list and stopped there, so a member
that drifted from `@objectstack/spec` was invisible to every layer that reads a
declaration. `page:header.actions` is the measured cost: the contract declares
`z.array(z.string())` ("Action IDs"), the renderer read the members as `ActionDef`
objects, and the repo-wide parity gate in
`apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` stayed green for the
whole life of the drift because both sides carried the key and neither could say what
was inside it. What settled it was a maintainer ruling, not a test — and even after the
fix, "these are ids" survived only as English in the registration's `description`.

**What is new.** `ComponentInput` gains an optional `of`, carrying the same coarse-kind
vocabulary as `type` one level down: the ELEMENTS of an `array`, or the VALUES of an
`object` used as a map. One kind, or an array of them for a member contract that is a
union, with `type`'s semantics — a member passes when any declared arm accepts it. The
manifest serializer forwards it, so `sdui.manifest.json` now carries seven keys per
input instead of six.

**Three readers ship with it**, which was the bar this slot had to clear (objectui#5905
is the precedent: five `ComponentInput` keys declared and read by nothing). The
repo-wide parity gate compares every declared `of` against the member kind
`ComponentPropsMap[type]` actually accepts and fails on one the contract refuses;
`sdui-parser`'s `validateTree` reports a member that fits no declared kind, as a new
`member-type-mismatch` diagnostic naming the offending positions; and the generated
`sdui-intrinsics.d.ts` narrows the authoring type — `page:header`'s `actions` is
`string[]` where it used to be `unknown[]`.

**Fifteen keys now declare one**, across ten blocks, each DERIVED rather than chosen:
every container key's member position was probed with one value of each coarse kind and
a declaration written only where exactly one kind was accepted. A member contract that
admits several kinds — `record:highlights.fields` takes a field name or an inline field
object — is deliberately left undeclared and pinned with its reason, because picking one
arm there is a narrowing this repo leaves un-gated and picking all of them would
advertise shapes only a per-block pin can vouch for.

**The ceiling is unchanged.** `of` is a KIND and never a value domain, so the maintainer
ruling of 2026-08-17 quoted on `ComponentInput.type` — the coarse arm plus `description`
is the publication face's expression ceiling, and spec is the sole judge of values —
stands exactly as written. `of: 'object'` says the members are objects; which keys they
carry is still `description`'s job and `os validate`'s.

**Nothing published before this changes.** An input that declares no `of` validates,
serializes and types byte-identically: `validateTree` checks no member, the serializer
emits no key, and the codegen emits the same `unknown[]`.
