---
'@object-ui/app-shell': minor
---

**Breaking (compile-time only):** `buildExpressionUser`'s PARAMETER is now the session
contract — `ExpressionUserSession | null | undefined` instead of `unknown` — so every call
site is checked against it (objectui#6559).

objectui#6551 narrowed the CAST the normaliser read its input through, so the module began
DECLARING what a signed-in session is: `id`, `name` and `email` required, mirroring
`@object-ui/auth`'s `AuthUser`. The parameter behind that cast stayed `unknown`, so the
declaration bound nothing — every call site satisfied it vacuously and
`buildExpressionUser({ name: 'B', email: 'b@c.d' })` still compiled. A declaration nothing
checks is indistinguishable from no declaration at all (AGENTS.md #0.1). The cast is gone
and the shape is stated once, on the parameter, so the declaration and the check are the
same statement rather than two that merely agree.

WHAT BREAKS, AND FOR WHOM. This tightens a signature published from the package entry
(`packages/app-shell/src/index.ts`), so an external caller that passes an unchecked or
under-declared value stops compiling on upgrade. That is accepted (maintainer ruling
2026-08-27, option A): the only calls it refuses are calls that were never conformant with
the contract the module already declared. It ships as `minor`, not `major` — objectui's
major tracks `@objectstack`'s, so its own breaking changes ship as a minor with the break
written down (`scripts/check-changeset-no-major.mjs`). ⛔ Keeping `unknown` and ⛔ adding a
second, wider entry point were both declined.

NO RUNTIME BEHAVIOUR MOVES. All four in-repo production call sites pass `useAuth().user`,
typed `AuthUser | null`, and type cleanly unchanged — two in `console/AppContent.tsx`, one
in `views/RecordFormPage.tsx`, one in `apps/console`'s `InternalFormRoute.tsx`. The body is
byte-equivalent: the same keys, the same `??` defaults, the same anonymous branch. ⛔ No
consumer-side fallback was added; `id: u.id ?? null` remains the rejected shape (triage
ruling 2026-08-26), because a lenient default in the consumer is what AGENTS.md #0.1
forbids and it silently equates "signed in, no id" with "signed out".

Note for callers holding the SPEC's `AuthUser` rather than `@object-ui/auth`'s: the spec
type is an `interface` with no index signature, and TypeScript infers an implicit index
signature for type aliases only, so it is not assignable to a contract declaring
`[key: string]: unknown`. `@object-ui/auth`'s `AuthUser` extends it and adds that index
signature, which is what every call site here passes.

Pinned by the new `expressionUser.parameterContract.types.test.ts`, compiled by the
package's `tsconfig.test.json` (chained off `type-check`, which CI runs). Its refusals are
`@ts-expect-error` directives, so a re-widened parameter makes them UNUSED and TS2578 turns
the type-check red; a type equation on `Parameters<typeof buildExpressionUser>[0]` reds
alongside them. Every refusal is routed through a non-fresh value, so what is measured is
the parameter and not excess-property freshness.
