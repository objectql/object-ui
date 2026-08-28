---
---

Traceability only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. The change is comment text at seven live source sites; no
executable line moves, and `git diff -U0` carries zero non-comment added or removed lines.

`server enforces, client is courtesy` was cited at those seven sites as a bare
**`ADR-0057 D10`**. The substantive claim is correct and is unchanged here; what was missing
is the **framework qualifier**. In this repository the bare string resolves to
`docs/adr/0057-console-ai-chat-one-conversation-docked.md` — a document about console AI chat
docking, which contains no `D10` at all and is the one a reader greps first. The intended
anchor is the *framework's* ADR-0057, whose D10 decides *"Setup-nav surfacing follows the
capability (ADR-0029 K2); the object stays open"*.

Each site now carries the disambiguation already shipped by the two authorities in this
repository — `docs/adr/0036-field-conditional-rules.md:91` and
`packages/core/src/evaluator/fieldRules.ts:38` — rather than a third phrasing:
`the framework's ADR-0057 D10 — framework numbering; this repo's own ADR-0057 is an
unrelated document`.

Three sites are deliberately left byte-untouched, all three already correct:
`packages/data-objectstack/src/appAccessProbe.test.ts:25` (a verbatim quotation of the
objectstack#8013 ruling, and about the capability/nav gate — the one family D10 really does
decide), plus the two authorities above.
