---
"@object-ui/plugin-detail": patch
"@object-ui/components": patch
---

Four spec keys the renderers already honoured are now discoverable from the published `inputs`

`record:details.hideFields`, `record:related_list.relationshipValueField`,
`record:related_list.add` and `element:text_input.defaultValue` were declared by
`@objectstack/spec` and read by their renderers, while the registry `inputs` —
the surface `gen-manifest.ts` serializes into `sdui.manifest.json` and
`sdui-intrinsics.d.ts` — never mentioned them. Nothing anywhere reported the
mismatch, and every layer that reads a manifest said the opposite of the
runtime: the keys were in no designer panel and no generated `.d.ts`,
`sdui-parser`'s prop walk returned `unknown-prop` for an author who wrote one,
and the renderer honoured it regardless. That is objectui#3407's original
complaint (`readonly` was enforced and honoured, the description just never said
so) on four more keys.

Each description is derived from what the renderer actually does, not from
restating the spec's one-liner, because the two can differ and the published
text is what an AI author reads:

- `hideFields` documents bare field names only — the renderer tolerates
  `{name}` / `{field}` entries but the spec is `z.array(z.string())` and rejects
  them, so teaching that spelling would publish a dialect the contract refuses;
- `relationshipValueField` publishes the renderer's `'id'` default and says that
  the resolved value drives the list filter, the Add-picker link value and the
  pre-filled create form together;
- `add` publishes its member shape in prose (`ComponentInput` is flat and has no
  member-shape slot) with each default taken from the renderer — including
  `picker.labelField`, where the renderer defaults to `name` while the spec's
  own wording says "the object title field". It also names `picker.filter` as a
  KNOWN GAP rather than documenting it as a restriction: the spec declares it
  and nothing reads it, so an author would otherwise believe their picker is
  scoped when it offers every record (objectui#3831);
- `defaultValue` distinguishes the two behaviours an author can get — seeding a
  bound page variable once while it is still empty, versus the native
  uncontrolled initial value with no variable bound.

`element:text_input` is not in the public tier, so its gap was not in
`sdui.manifest.json` at all — it was in the JSX-page compiler's prop whitelist,
which `renderers/layout/page.tsx` builds from `getKnownTypes()` plus these same
`inputs`, making the undeclared `defaultValue` a live `unknown-prop` warning.

The repo-wide parity gate now runs in both directions over one covered set and
one exemption discipline, so neither direction can be forgotten again the way
the reverse half was after PR #3806. Nine spec keys stay deliberately
unpublished, each with a written reason and a tracking issue: two the renderers
do not read at all (objectui#3829), three retired upstream by ADR-0087
tombstones, `page:tabs.type` (a carrier collision, objectstack#6776), two
`targetVariable` declarative hints (objectui#3834), and
`element:record_picker.filter` (objectui#3830).
