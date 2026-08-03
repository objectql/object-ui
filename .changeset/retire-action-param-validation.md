---
"@object-ui/types": minor
"@object-ui/core": minor
---

Retire `validation` from the action-param contract — it was declared on both
halves, read by neither, and rejected outright by the server (objectui#3201).

FROM: `validation?: string` was declared on the AUTHORING type
(`@object-ui/types`' `ActionParam`) and on the RESOLVED type (`@object-ui/core`'s
`ActionParamDef`). TO: it is declared on neither.

**Breaking for anyone who declared it — but it never did anything.** This is
marked `minor`, not `major`, per the repo's version-alignment policy (objectui's
major tracks `@objectstack`'s, so objectui's own breaking changes ship as `minor`
with the breaking semantics spelled out here).

**Migration: delete it.** If you authored `validation: '...'` on an action param,
it never took effect, and publishing that metadata to the server is a hard parse
failure — so any metadata that reached production either never carried the key or
never parsed. Removing it changes no runtime behaviour; it only moves the error
from "silent no-op, then rejected at publish" to a `tsc` error at the keystroke.

Why it could not work as authored:

- `ActionParamSchema` in `@objectstack/spec/ui` is `.strict()` and does not list
  `validation`, so an authored key is a PARSE REJECTION on the server:
  `Unrecognized key(s) on this action param: \`validation\``. Meanwhile `tsc`
  against the public type accepted it — the type vouched for a key the platform
  itself refuses.
- Nothing read it on the resolved side either: it was never a key of
  `resolveActionParams()`'s `RawActionParam`, the runtime field metadata a
  field-backed param inherits from carries no `validation` to source one from,
  and `paramToField()` never mapped it — so it could not reach the field widgets,
  whose rules `buildValidationRules()` builds from `required` / `minLength` /
  `maxLength` / `pattern`.

Removed rather than implemented, on ADR-0049 enforce-or-remove. Giving it meaning
would mean first deciding what an "expression" is here (CEL? a formula? a regex?)
and adding it to `@objectstack/spec`, which is where such a capability has to
start — not accreted renderer-side around a key the contract does not have.

This also retires the last named exception in objectui#3174's drift guard
(`packages/types/src/__tests__/page-nav-misc-spec-parity.test.ts`), which carried
`validation` as the one key `ActionParam` added on top of the spec's set. The
rule it pins — **the authoring type declares exactly the spec's authorable
keys** — is now literal: the guard asserts the local-only key set is empty, so
any future addition fails the build instead of being waved through.
