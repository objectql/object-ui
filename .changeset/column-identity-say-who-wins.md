---
"@object-ui/core": patch
---

feat(core): say which column identity key won, out loud (#3104 PR3)

Closes the battle opened in #3104. PR1 (#3119) put the canonicalizing fold at
ingestion; PR2 (#3122) converged all 22 read sites onto `columnIdentity()`.
This is the audible half.

A column carrying two identity keys that **disagree** — `{ field: 'account',
name: 'account_name' }` — now logs a one-time dev-mode warning naming which key
won and what to change:

```
[ObjectUI] Column carries two identities: `field: 'account'` and
`name: 'account_name'`. `field` wins — it is the only key `ListColumnSchema`
declares — and `name` has been rewritten to match, so the rendered column and
the requested field agree. Fix the producer: drop `name` and author `field`
only. (objectui#3104)
```

The fold making the two halves agree is what stops the bug, but silently
rewriting `name` to match `field` also hides that the producer is emitting a
contradiction. The renderer recovering is not the same as the metadata being
right, so the recovery says so.

Deliberately narrow:

- **Only contradictions.** A legacy-only column (`{ name: 'stage' }`) is legacy,
  not conflicting — it is stamped without noise.
- **Warn once per (identity, conflicting spelling).** Columns are re-normalized
  on every render; a warning that floods the console is a warning that gets
  muted. Keyed by the pair rather than the identity alone, so a column carrying
  two different stale spellings reports both — the author needs to fix every
  producer, not just the first one seen.
- **Silent under `NODE_ENV=production`**, and the fold still runs there.

`resetColumnIdentityWarnings()` is exported for tests.

**No lint rule, and that is a measured decision.** #3104 asked for
`no-restricted-syntax` on `.field ?? .name` to be evaluated on its
false-positive rate first. With the family at zero, all 12 remaining scanner
hits are legitimate — a syntactic rule cannot tell a two-layer join from a dual
read, because the distinction is what the keys mean in that layer, not how the
expression is spelled. Adopting it would mean 12 inline disables on correct
code, which trains the next author to reach for the disable. The ratchet carries
a `verdict` and a `why` per site instead, so a new hit gets triaged rather than
silenced. The evaluation is written into the ratchet's header.

**Ledger item resolved with no change needed.** #3104 flagged `ListColumn` for
disposition under objectstack#4115 (spec-named symbols must be imports, not
declarations). `ListColumnSchema` is already a by-reference re-export of
`@objectstack/spec/ui`, and `spec-subschema-parity.test.ts` already pins it by
reference identity — the only check that distinguishes a re-export from a
faithful fork. Already compliant; nothing to do.
