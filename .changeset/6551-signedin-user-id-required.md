---
'@object-ui/app-shell': patch
---

`buildExpressionUser`'s signed-in cast declares `id`, `name` and `email` REQUIRED, so it is
no longer wider than the contract it mirrors (objectui#6551).

The normaliser reads its input through a cast, and that cast wrote all three keys optional
(`{ id?: string; name?: string; email?: string; … }`) while the signed-in branch forwards
exactly those three RAW. So the declaration said `buildExpressionUser({ name: 'B', email:
'b@c.d' })` was a legitimate input, and the code answered `{ id: undefined, … }` for it —
present-and-always-`undefined`, which is the shape objectui#5424 removed `roles` from this
same object for ("the shape that teaches the wrong thing") and the one objectui#6534
refused for the anonymous branch, one key over. The three keys BELOW them already defended
with `??`; the asymmetry sat inside one object literal.

The contract disagreed with the cast. Every production input is `useAuth().user`, typed as
`@object-ui/auth`'s `AuthUser`, which extends the spec's `AuthUser`
(`@objectstack/spec/contracts`): `id: string; email: string; name: string`, with only
`positions` and `tenantId` optional. `name` and `email` are narrowed alongside `id` because
that same interface declares them required too — the same answer from the same authority,
not a widened scope. `role` stays optional (it is `@object-ui/auth`'s display-only
addition, not a spec key), and the index signature stays (better-auth projects an app's
custom user columns onto this object, and it is how `isPlatformAdmin` / `positions` are
read).

NOTHING REACHABLE CHANGES, and deliberately so. The only production producer is a
better-auth principal that always carries `id`, which is why this was graded a latent shape
hazard rather than a bug, and why the fix moved a declaration and no runtime behaviour: the
defect was that the cast LIED about the contract. `id: u.id ?? null` was the rejected shape
(triage, 2026-08-26) — a lenient default in the consumer is what AGENTS.md #0.1 forbids and
what objectui#6534 shipped a scope fence against, and it silently equates "signed in, no
id" with "signed out". A producer without an `id` is wrong at the producer.

Because `id?: string` and `id: string` produce byte-identical output for every input a
producer can supply, no runtime assertion can pin this; the new
`expressionUser.sessionContract.types.test.ts` drives `tsc` itself over the real
declarations and carries its own discrimination leg — the same cases compiled a second time
against the pre-fix optionality, with the five that flip named by index.

No fault-handling path moved. Fail-open on a predicate that DOES fault stays deliberate
policy (objectui#6443 / #6487 / #6445).
