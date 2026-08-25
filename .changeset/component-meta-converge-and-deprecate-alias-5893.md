---
'@object-ui/types': minor
---

`ComponentMeta` is now declared once and re-exported, and `PluginComponentMeta` is
deprecated in favour of `ComponentMeta` (objectui#5893).

## The convergence

`@object-ui/types` published `ComponentMeta` twice, from two different declarations:
`base.ts` and `plugin-scope.ts` (the latter published as `PluginComponentMeta`). They
were structural copies, not an alias pair. `plugin-scope.ts`' `ComponentMeta` is now
`export type { ComponentMeta } from './base.js'` — the disposition objectui#4580 ruled
for the identical shape, *a structural copy would reproduce the defect the moment either
side moved*, and the same move objectui#5671 made for the sibling type `ComponentInput`
in the same file.

Either side had already moved. `base.ts` declared eleven keys; the plugin-scoped copy
declared nine — the same nine, **minus `tags` and `description`**. So a plugin author
typing against the plugin-facing declaration could not write two keys the main surface
advertises, and which the runtime validator already accepted: `ComponentMetaSchema` in
`zod/base.zod.ts` declares all eleven, so two of the three authorities agreed and the
plugin-facing one did not. `resizeConstraints`' six members were identical in both, so
the delta was exactly those two keys.

What changes for a consumer: `tags` and `description` become writable on the
plugin-facing type. Nothing narrows — no key is removed and no key's type changes, so no
existing registration stops compiling. The convergence buys **acceptance** of two keys;
it buys no rejection of anything. `ComponentMetaSchema` is a plain `z.object` with no
`.strict()`, so it strips unknown keys rather than refusing them, and that is unchanged
here.

## The alias deprecation, sequenced after it

`PluginComponentMeta` — the published alias for the plugin-scoped declaration — is now
`@deprecated` in favour of `ComponentMeta`. **`PluginComponentMeta` is the name to search
for** if you import it; replace it with `ComponentMeta` from the same entry point.

This is stage 1 of objectui#5674's two-stage retirement (maintainer ruling, 2026-08-22:
deprecate for a release, then remove). Nothing is removed here — the export still exists
and still names the same type.

The ordering is deliberate and is why the two halves ship together. Until the convergence
above, the alias named a genuinely different nine-key interface; deprecating it then
would have warned consumers about a name that was still about to change meaning. It is
deprecated now, at its final meaning.

**Why a deprecation window rather than a deletion.** The measurement that licenses
deleting an export from a published package is *"no importer"*, and what can be measured
from inside this repository is only *"no importer here"*. In-repo, `PluginComponentMeta`
has exactly one occurrence — its own export line — searched across every root
(`packages/`, `apps/`, `content/`, `docs/`, `skills/`, `examples/`, `e2e/`, `scripts/`,
`eslint-rules/`, `public/`, `.changeset/` and the root docs) plus the sibling
`objectstack` framework checkout, with controls searched identically so a broken search
could not read as a clean one. What no search here can see is a consumer on npm. **That
external caveat is unchanged from objectui#5674 and is not being dropped:** the window
converts a silent break into a warned one before stage 2 lands. Stage 2 removes the alias
and the now-dead re-export in `plugin-scope.ts` that exists only to feed it, and ships as
a `minor` under this repo's policy that its own breaking changes never declare `major`.

## Pinned by identity, not by member set

A new test asserts that `plugin-scope.ts` re-exports the declaration and declares no
`ComponentMeta` of its own. A member-set assertion cannot do this job: TypeScript is
structurally typed, so a local re-declaration carrying the same eleven keys is mutually
assignable with the imported one and passes every type-level check. A member-identical
structural copy is exactly what objectui#4580 predicted would drift and exactly the state
this card recorded — this copy started identical and acquired its two-key delta later.
The member-set checks are kept alongside the identity pin, labelled as the control that
shows what it cannot see.
