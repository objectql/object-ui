---
"@object-ui/app-shell": minor
"@object-ui/core": minor
"@object-ui/data-objectstack": minor
"@object-ui/console": minor
---

Bring the whole `@objectstack` family to `17.0.0-rc.1`, so the dependency graph resolves a
single copy of `@objectstack/spec`.

#3178 bumped **only** `@objectstack/spec` to `17.0.0-rc.1`. The rest of the family —
`client`, `core`, `formula`, `lint` (and `sdui-parser`, reached through `lint`) — stayed on
`17.0.0-rc.0`, and each of them depends on spec at an **exact** version rather than a
caret:

```
@objectstack/client@17.0.0-rc.0  -> spec "17.0.0-rc.0"
@objectstack/core@17.0.0-rc.0    -> spec "17.0.0-rc.0"
@objectstack/formula@17.0.0-rc.0 -> spec "17.0.0-rc.0"
@objectstack/lint@17.0.0-rc.0    -> spec "17.0.0-rc.0"
```

So `main` carried **two** spec copies: objectui's own code read `17.0.0-rc.1` while every
`@objectstack/*` package read `17.0.0-rc.0` from its own nested `node_modules`. That breaks
the single-contract invariant this repo's guards are built on, and it breaks them
*silently* — the affected checks depend on identity, not on version strings:

- `spec-subschema-parity.test.ts` distinguishes a genuine re-export from a fork by
  **reference identity** of the zod schema object. Two spec copies make every schema a
  distinct object, so a real re-export starts reading as a fork (or a fork slips through,
  depending on which copy each side resolved).
- `scripts/check-spec-symbol-derivation.mjs` and `spec-symbol-parity.test.ts` use
  `createRequire` to resolve spec's `.d.ts` and run it through the TS checker. With two
  copies installed, *which* declaration file the checker sees is a function of resolution
  order rather than of intent.

The declared ranges were already `^17.0.0-rc.0`, which technically admits rc.1 — the pin
lived in the lockfile. Raising the remaining ranges to `^17.0.0-rc.1` makes the floor
explicit and forbids a future install from silently sliding back onto a family member that
drags rc.0 along with it. The rc.1 family members pin spec at `17.0.0-rc.1` exactly, so the
graph now converges on one copy by construction, not by luck.

No product behaviour changes here. `check:spec-symbols` reconciliation was already
completed by #3178 and stays green under the unified graph; this changeset is `minor`
per the repo's fixed-group version policy.
