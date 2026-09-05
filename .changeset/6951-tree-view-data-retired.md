---
'@object-ui/types': minor
'@object-ui/components': minor
---

**Breaking for authored metadata:** `TreeViewSchema.data` is RETIRED (objectui#6951,
maintainer ruling B1 of 2026-09-04; ADR-0049 enforce-or-remove). A `tree-view`
node that authors `data` no longer validates: the parse fails loudly on the
`data` path with the explanation in the message, the TS member is a `?: never`
tombstone so the same document is refused at compile time, and the renderer no
longer reads the key. Write `nodes` — or bind the tree with `bind`, which is
unchanged and still read first.

**What was measured, on this branch's base.** `TreeViewSchema` declared two
spellings for its one inline-nodes slot — `nodes` (read second) and `data` (read
third: `boundData || schema.nodes || schema.data || []` at
`renderers/data-display/tree-view.tsx:105`), both declared by objectui#6150.
`data` had been REQUIRED until objectui#6939 / PR #7533 made it optional, so
this retirement starts from a declared-and-optional member on both faces. The
in-repo corpus at the retirement: seven `tree-view` nodes under
`examples/schema-catalog` and `packages/types/examples` plus one `content/docs`
fence — six on `nodes`, two on `data` (`packages/types/examples/data-display-examples.json`
and `content/docs/api/schema-reference.md`), both rewritten; no package source
authored either spelling.

**Who is affected — a `data` authored on a `tree-view` node:**

```json
{ "type": "tree-view",
  "data": [{ "id": "root", "label": "Project" }] }   // ← was tolerated (read third)
```

now fails validation with:

> RETIRED (objectui#6951) — `data` is no longer part of TreeViewSchema; write
> `nodes` (or bind the tree with `bind`). It was the second spelling of the one
> inline-nodes slot, read only as the last limb of
> `boundData || schema.nodes || schema.data || []`, and was retired under
> ADR-0049 enforce-or-remove with no deprecation window (maintainer ruling B1,
> 2026-09-04). The renderer reads `bind` then `nodes` now, so an authored `data`
> would render an empty tree. Rename the key; the array is unchanged.

**Two published faces, one retirement — and why a tombstone, not a deletion.**
The TypeScript interface `TreeViewSchema` (`@object-ui/types`, `data-display.ts`)
declares `data?: never`; the Zod mirror `TreeViewSchema` (`@object-ui/types/zod`,
`data-display.zod.ts`) declares `data` as a `retirementTombstone()`. `BaseSchema`
already declares `data?: any` (`z.any().optional()` on the mirror), so DELETING
the member would not have refused the key — it would have ADMITTED it,
unvalidated, through the base member, and the renderer would have drawn an empty
tree. The tombstone on the extended schema shadows the base member on both
faces; the pin measures the base accepting the very document the extended
schema refuses.

**What the ruling kept, deliberately.** `nodes` stays OPTIONAL and no "at least
one of" presence rule was added: `{ "type": "tree-view", "bind": "treeNodes" }`
is a legal, rendering document (`bind` is the first source the renderer reads),
and a bare `{ "type": "tree-view" }` stays legal as PR #7533 left it.
`TreeNode.data` — the per-node payload on each tree node — is a different
member on a different schema and is untouched.

**`@object-ui/components`** — the `tree-view` renderer's read is
`boundData || schema.nodes || []`; nothing else in the package moves.

**Who is NOT affected.** A document that already wrote `nodes` (the four
`components-data-display-tree-view/*` catalog entries and the nested tree in
`components-complex-resizable/editor-interface.json`) is untouched; `title`,
`bind`, the selection / expansion keys and `className` are unchanged. The
catalog is now pinned tree-wide against the retired spelling.

**Migration:** rename `data` to `nodes` on every `tree-view` node; the array is
unchanged. If a document authored both, `nodes` was already the value that
rendered — delete `data`.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated spelling. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
