---
"@object-ui/create-plugin": patch
---

Remove the scaffold's unused pinned icon dependency, and make its generated schema interface reachable

Two declared-but-unreachable artifacts in the generated plugin, both on the blind side of
the import gate objectui#3733 added — that gate rejects an import nothing declares, and
never looked for a declaration nothing imports.

**The generated `dependencies` no longer pin `lucide-react`** (objectui#3755). It was
declared at `^0.563.0` and imported by no generated source file, so every freshly
scaffolded plugin really installed lucide 0.563.x for code that never referenced it — two
majors behind the 23 in-repo declarations, all `^1.28.0`. Worse than ordinary caret drift:
a `0.x` caret does not cross minors, so `^0.563.0` is `>=0.563.0 <0.564.0` and could not
float even within `0.x`. It is removed rather than re-anchored because this repo declares
an icon library where it imports one — of the 24 manifests mentioning `lucide-react`, 23
import it, and none pre-declares it for code not yet written. An author who wants icons
runs `pnpm add lucide-react` and lands the current version by construction, with no anchor
table to maintain for an unused entry. The generated `dependencies` is now exactly the four
`workspace:*` platform packages, which cannot drift at all.

**The generated `src/index.tsx` now re-exports the schema interface** from `src/types.ts`
(objectui#3759). The generated `exports` map exposes exactly one key — `.` — so the entry
is a consumer's only door, and nothing walked through it to `src/types.ts`: no generated
source imported it, and the deep paths that would have reached it (`<pkg>/types`,
`<pkg>/dist/types`) are closed by that same map. The interface in it is the plugin's schema
contract, and it shipped dead — while the generator's own documentation page told authors to
"export your schema types … make it importable rather than internal". A named type-only
re-export, matching the four in-repo plugins that ship a `src/types.ts` and the worked
example in the plugin-development guide.

**That interface now extends `BaseSchema` from `@object-ui/types`** instead of re-declaring
a subset of the base node. Unreachable, a hand-rolled `{ type; id?; className? }` was only
dead weight; published, it would be a second dialect of a node the protocol already defines,
silently missing everything else `BaseSchema` carries (`name`, `label`, `visible`, …). Only
the `type` literal is narrowed locally, the same shape every in-repo plugin uses. This also
makes the generated `@object-ui/types` dependency a used declaration.

Both halves are pinned structurally rather than by string match, so the next dead artifact
fails a test instead of shipping: no versioned runtime dependency may be declared that no
generated source imports (`workspace:*` exempt — it cannot drift), and no generated `src/**`
module may be unreachable from the single entry the `exports` map exposes. Each of those
gates passes over an empty result on today's templates, so each is paired with a self-test
that plants the removed defect back and asserts the rule names it — a gate that is green
because it produces nothing is not a gate.
