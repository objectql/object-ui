---
---

Test-only change: the ADR-0080 preview harnesses' page sources are now held to
`object-ui/no-unprefixed-query-params` by that rule itself, run over the source
strings ESLint structurally cannot reach inside a template literal
(objectui#5944). No published behaviour changes — the new file is a test under
`apps/console/src/__tests__/`, and `eslint-rules/` is a repo-local plugin
directory rather than a workspace package.
