---
---

Test-only (objectui#3809). The gates that ask "does `@objectstack/spec` accept this key?" now
subtract ADR-0087 D2 tombstones instead of reading raw `Object.keys(schema.shape)`, and the
judgement lives in one place: `@object-ui/test-support`'s `spec-tombstones` module.

Retiring an authorable key upstream does not delete it. `retiredKey()` replaces the member with
`z.never().optional()` on purpose — a deleted key is silently stripped by a non-strict parse,
while a `never` member fails `tsc` at the authoring site and raises the upgrade prescription on
parse. So a retired key stays in the shape, and every gate deriving "the accepted keys" from raw
`Object.keys` was answering a different question than its name claimed. In
`apps/console/src/__tests__/registry-inputs-spec-parity.test.ts` both parity directions read that
one set and failed opposite ways on it: the forward direction (a block may not declare a key the
spec rejects) counted the tombstone as accepted and went falsely GREEN, while the reverse
direction (every spec key must be discoverable) counted it as declared and went falsely RED,
demanding that a block publish a key the contract refuses by name.

Not dormant, contrary to the issue's premise: it was filed against `17.0.0-rc.5`, which carried no
tombstone in `ComponentPropsMap`, and the `17.0.0-rc.6` pin (objectui#4167) brought eight —
`page:header.icon`, `page:card.actions`, `page:card.body`, `page:tabs.type`,
`record:details.layout` and the `element:record_picker` `displayField` / `searchFields` /
`multiple` trio. The reverse direction's red was live from that pin, absorbed key by key by eight
explicit exemptions that each named this issue as the only thing that could clear them. All eight
are deleted here — not by hand-picking, but because the narrowing makes the existing
dangling-and-stale checks report every one of them. The mechanism is self-clearing from now on: a
key upstream retires later leaves the accepted set on arrival and takes any exemption covering it
with it, no follow-up issue required.

`packages/layout/src/__tests__/page-header-authorable-keys.test.tsx` drops its local copy of the
probe for the shared one, as its own note asked; the shared judge adds a second recognition
channel (the `[REMOVED]` marker `retiredKey()` stamps on the description, OR-ed with the
structural criterion so neither can quietly go permissive) and is calibrated once against what
the installed contract's `safeParse` really rejects. Both consuming gates assert the derivation's
premise — that a retirement KEEPS the member — so if upstream ever retires by deleting keys, the
filters are judged dead code instead of silently narrowing nothing. Two further local copies of
the same judgement remain in `packages/plugin-detail` and `packages/app-shell`, both correct
today; objectui#4947 tracks converting them. No published behaviour changes, so this declares no
release.
