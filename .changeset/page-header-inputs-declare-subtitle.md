---
"@object-ui/layout": patch
---

The legacy `page-header` alias stops advertising `description` as an authorable
key (objectui#3226).

FROM: `registerLayout()` declared `inputs: [title, description]`. TO:
`inputs: [title, subtitle]` — the key `@objectstack/spec/ui`'s `PageHeaderProps`
declares, and the one the canonical `page:header` renderer in
`@object-ui/components` already declares.

`inputs` is a DECLARATION surface, not documentation: the designer builds its
property palette from it, and the framework's `check:react-declaration-parity`
diffs it against the spec schemas. Declaring `description` therefore did not
merely tolerate a legacy spelling — it published a second dialect for the one
concept the protocol calls `subtitle`, and told authors (an AI author most
readily, since the registry is what it reads to learn the shape) that the
non-spec key was legal. Metadata that took the offer renders a subtitle under
`page-header` and silently loses it under `page:header`: same JSON, two results,
which is the outcome a single contract exists to prevent.

No runtime behaviour changes. `PageHeader` still reads `subtitle ?? description`,
deliberately: this alias exists for out-of-repo consumer schemas, so "no in-repo
author writes `description`" (verified — zero hits) is not evidence that nobody
does, and dropping the read today would delete an external page's second line
while its title kept rendering, the least reportable failure mode there is. That
read is retired together with an ADR-0087 D2 conversion entry
(`page-header-subtitle-alias`, `description` → `subtitle` rewritten at load
time), which lives in the framework repo and is tracked separately. Narrowing the
declaration did not need to wait on it and breaks no consumer; leaving the
declaration wrong in the meantime keeps minting the metadata the conversion would
then have to absorb.

New tests pin both halves so neither can drift back: the registration may not
declare `description`, must declare `subtitle`, and — checked against the spec's
own shape rather than a hand-written allowlist — may declare nothing
`@objectstack/spec` does not; while the runtime fallback is pinned as a sequencing
guard, to be deleted in the same change that lands the conversion entry.
