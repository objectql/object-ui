---
---

Drops one prose sentence in `content/docs/guide/ci-cd-pipeline.md` off a spelling-level
absolute (objectui#6448). The "adding a new workflow" steps used to say a fossilised
example block pinned `node-version: 20` "where every workflow declares `'22.x'`" — but
one lane, `.github/workflows/half-state-patrol.yml`, spells it `'22'` rather than
`'22.x'`, so the quoted claim was false by exactly that one lane's quoting, even though
every workflow agrees on the major.

Re-measured on the branch point (`d3bf4fa6f`): 29 declarations spell `'22.x'`, 1 spells
`'22'`, all 30 read major 22. The sentence now reads "where every workflow declares 22" —
true today, and it stays true if `half-state-patrol.yml` is later normalised to `'22.x'`
(a separate change, objectui#5986), because the sentence no longer asserts a spelling.

This is disposition A from the finding, the one both the card and triage recommended:
the paragraph is teaching "don't copy a fossilised pin", and the quote-mark spelling of
the current value was never part of that lesson — asserting it was is exactly the
count/spelling-shaped fact objectui#6400 and #6447 are open about elsewhere on this same
page. No other part of the paragraph changed (the `@v7` and `pnpm/action-setup@v4` claims
still measure true), and `scripts/__tests__/doc-version-claims.test.ts`'s ledger entry for
this sentence (`node-version: 20`, landed by objectui#6409) needed no edit — its `why` was
already phrased at the version level, not the spelling, so page and ledger now agree.

Docs-only prose fix; no published behaviour changes, hence empty frontmatter.
