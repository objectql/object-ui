---
'@object-ui/types': patch
---

`PluginComponentInput` is deprecated in favour of `ComponentInput` (objectui#5674).

This is stage 1 of a two-stage retirement the maintainer ruled on 2026-08-22: deprecate
for a release, then remove. Nothing is removed here — the export still exists and still
names the same type.

`@object-ui/types`' entry point publishes `ComponentInput as PluginComponentInput`. Until
objectui#4972 that alias pointed at a genuinely different declaration: `plugin-scope.ts`
restated its own nine-key `ComponentInput`. objectui#5671 converged that declaration onto
`base.ts`, so the alias became a second published name for the *same* type, carrying no
information the first does not. Two published names for one type is a shape that costs
readers a step and gives AI-authored code a coin-flip between spellings.

**Why a deprecation window rather than a deletion.** The measurement that licenses
deleting an export from a published package is *"no importer"*, and what can be measured
from inside this repository is only *"no importer here"*. In-repo the name has zero
importers — searched across every root (`packages/`, `apps/`, `content/`, `docs/`,
`skills/`, `examples/`, `e2e/`, `scripts/`, and the root docs), plus the sibling framework
repository, with a control name searched identically so a broken search could not read as
a clean one; the only occurrences are the alias itself and prose about it. What no search
here can see is a consumer on npm. The deprecation window is the answer to that
unmeasurable half: it converts a silent break into a warned one before the removal lands.

**Reversibility, deliberately.** Deprecating is undoable; deleting a published export is
not. Where the evidence is one-sided, the retirement takes the reversible step first.

The tag reaches consumers rather than only the source: a JSDoc block on an export
specifier survives declaration emit and lands attached to that specifier in the emitted
`index.d.ts`, which was measured for this change rather than assumed. With comments
stripped, the emitted entry point is byte-identical before and after — the published
*type* surface does not move, it only gains the notice.

Stage 2 (removing the alias, and the now-dead re-export in `plugin-scope.ts` that exists
only to feed it) is filed as a follow-up and ships as a `minor`, per this repo's policy
that its own breaking changes never declare `major`.
