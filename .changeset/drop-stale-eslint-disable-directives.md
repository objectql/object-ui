---
---

Comment-only cleanup (objectui#4833). Removed all 49 `eslint-disable` directives that ESLint
itself reports as `Unused eslint-disable directive (no problems were reported from 'X')` —
suppressions whose underlying finding no longer exists, spread over 35 files in 17 packages.

No published behaviour changes: the diff removes comment lines and nothing else. The single
line that is modified rather than deleted is `apps/console/src/pages/developer/PublicFormsPage.tsx:151`,
where the directive sat inline inside a statement, so only the comment was stripped and the
`useEffect` call itself is byte-identical.

The judgement was never ours: every site was taken from ESLint's own `ruleId: null` report,
and the whole-repo counts reconcile exactly — warnings 9828 to 9779 (−49, one per directive),
errors 0 to 0, unused directives 49 to 0, and **no other rule's count moved in either
direction**. That last figure is what proves the deletions were inert: had any directive still
been load-bearing, removing it would have surfaced the rule it was suppressing.

Twenty of the 49 sat on `no-console`, which this repo's config sets to `error` (the objectui#4029
ratchet) — they were dead because that rule is configured `{ allow: ['warn', 'error'] }` and the
calls beneath them are `console.warn` / `console.error`, or because the file is one the config
turns `no-console` off for. A stale suppression on an error-level ratchet is the kind of comment
a later reader copies as precedent, which is why they are worth removing rather than tolerating.
