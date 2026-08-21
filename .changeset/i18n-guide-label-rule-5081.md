---
---

Docs + gate ledger only — this publishes nothing, declared explicitly with an empty
frontmatter rather than left undeclared.

`skills/objectui/guides/i18n.md` attributed its label rule to `@objectstack/spec` v4 in two
places (`:117`, `:162`) while every manifest here declares `^17.0.0` and `node_modules`
carries `17.0.0` — thirteen majors, on the surface an AGENT reads before it writes a user's
project. The version number was the reported defect; measurement against the installed
package found the rule it was backing to be wrong as well, which is why neither arm of the
original fork (renumber to v17, or drop the qualifier and keep the sentence) was writable:
both would have laundered a v4-era false statement into a current one. Maintainer ruling
2026-08-20, option A: restate the rule per the installed spec, with no version qualifier.

Measured against `@objectstack/spec` 17.0.0's published dist, `I18nLabelSchema` is a union
of a plain string and an inline locale map whose keys must match
`/^(default|[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*)$/` — a BCP-47 tag, or `default`. The guide now
states both forms, shows an inline-map example on the two keys this repo was measured to
resolve (`card.title` and `button.label`, both through `pickLocalized`), and keeps its
"don't use `{key, defaultValue}`" advice with the real reason: that key-reference vocabulary
was retired in objectstack#5055, the spec rejects the object with its own message, and if one
reaches a renderer anyway `pickLocalized` falls through to the first string value and paints
the raw translation key on screen.

The `KNOWN_CLAIMS` entry that inventoried the fossil as `stale` is deleted in the same commit
— the downward ratchet in `scripts/__tests__/doc-version-claims.test.ts` ("no entry may
outlive the claim it excuses") turns red otherwise — and that file's header prose, which
restated the now-falsified two-branch fork, is corrected to record what the fork actually
turned out to be.
