---
---

Traceability only — this publishes nothing, declared explicitly with an empty frontmatter
rather than left undeclared. The change is comment text at eight live source sites; no
executable line moves, and `git diff -U0` carries zero non-comment added or removed lines.

`server enforces, client is courtesy` was cited at those eight sites as the framework's
**`ADR-0057 D10`**. That decision reads *"Setup-nav surfacing follows the capability
(ADR-0029 K2); the object stays open"* — nav-entry tiering, not enforcement location. The
rule these sites actually invoke is decided by the framework's **`ADR-0124 D1`**, *"The
server is the enforcement point; client-side gating is a usability courtesy"* (Accepted
2026-08-18). #5699 fixed the repo-ambiguity half of this defect — whose ADR numbering the
citation meant — and deliberately left the anchor half; this is that half.

The new anchor is derived from an authority, not chosen: the framework's own ADR-0057
carries a note aimed at precisely this citation — *"If a citation of `ADR-0057 D10`
brought you here looking for that rule, ADR-0124 is where it is decided."* The substantive
claim at every site is unchanged; only the anchor moves.

The disambiguating parenthetical #5699 shipped — *"framework numbering; this repo's own
ADR-0057 is an unrelated document"* — is retired along with the number it disambiguated.
It warned about a collision specific to `0057`; this repository has no ADR-0124 at all
(its own series stops at `0059`), and ADR-0124 records that a fresh, unambiguous number
was chosen so that citations of it would not need such a warning. The `the framework's …`
possessive stays at every site, so each one still says whose numbering it means.

Left byte-untouched, deliberately: `packages/data-objectstack/src/appAccessProbe.test.ts`
cites the same decision for *"an app gated by an absent optional service"* — the
capability/service-gating family that decision genuinely does decide, so it is correct as
it stands. `docs/adr/0036-field-conditional-rules.md`, the wording all eight derive from,
carries the same misattribution and moves in its own PR: `docs/adr/**` is a governed
surface that stops at draft for human merge.
