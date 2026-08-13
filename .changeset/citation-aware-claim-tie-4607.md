---
---

Tooling only — a CI guard and its own test suite, no package source, so no release.

`check:spec-symbols` rule 2 flags an exported declaration whose doc comment claims
`@objectstack/spec` alignment while the declaration references nothing spec-bound.
That tie test was symbol-AGNOSTIC: it asked whether the declaration referenced ANY
spec-bound identifier, so a claim about symbol X passed on an incidental reference
to an unrelated symbol Y.

`FeedItem` (packages/types/src/views.ts) was the live specimen (objectui#4607). It
cited `FeedItemSchema`, removed from `@objectstack/spec/data` in the 16.0.0 major,
and never appeared in a single gate run — purely because one member is typed
`FeedItemType`, the one feed symbol that removal kept. It sat four lines from a
section banner making the same claim, in the same file as four declarations that
WERE flagged, and it was found by reading the file rather than by any run.

The tie is now judged against the symbols the claim CITES: when a claim names
symbols and the installed spec exports none of them, the declaration is flagged
whatever else it references. A claim naming at least one live symbol stays governed
by the tie test unchanged — a claim-vs-tie mismatch among LIVE symbols is a
documented non-goal, since it needs a name-relatedness allowance for the legitimate
`type: FeedItemType` shape.

Measured repo-wide with the sharpened rule: the hidden population is zero. Of the
three declarations that carry a claim and pass the tie test, two cite only live
symbols and one is mixed, so no verdict in the tree changes and no ledger entry
moves (CLAIM_ALLOW 2, CLAIM_DEBT 18 in 5 packages, before and after).
