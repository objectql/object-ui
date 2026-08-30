---
---

Comment-only correction of the "WHY THIS EXISTS" header in
`packages/data-objectstack/src/aggregate-capability.test.ts`: it claimed
`@objectstack/client`'s `analytics.query()` never throws on a non-2xx. The
installed `@objectstack/client@17.2.0` does throw — `ObjectStackClient.fetch`
throws on `!res.ok` before `analytics.query` reaches its own `res.json()` —
and every test in the file depends on that throw reaching the adapter's
`catch`. No behaviour change; test assertions are unchanged (objectui#5954).
