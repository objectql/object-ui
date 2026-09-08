---
'@object-ui/types': minor
---

**Breaking for authored metadata:** `ObjectGridSchema` in `@object-ui/types/zod`
now DECLARES `exportOptions`, as `@objectstack/spec`'s own OBJECT arm bound by
reference, and REFUSES the bare format array by name (objectui#7762). An
`object-grid` document that authors `exportOptions: ['csv', 'xlsx']` no longer
validates through this package's mirror; it gets one `invalid_type` issue at
`['exportOptions']` whose message names the shape the renderer reads and tells
the author to write `{ "formats": ["csv", "xlsx"] }`. The retired `'pdf'` format
and a sixth key on the object form (`{ formats: ['csv'], compression: 'gzip' }`)
are refused on this node too, carrying the spec's own messages — the
`os migrate meta --from 16` prescription for `'pdf'`, and zod's
`unrecognized_keys` naming the extra key.

**What was measured, on this branch's base.** The mirror declared NO
`exportOptions` member at all, and `BaseSchema` is `.passthrough()`, so
`ObjectGridSchema.safeParse({ type: 'object-grid', objectName: 'accounts',
exportOptions: ['csv', 'xlsx'] })` returned `success: true` with the array back
VERBATIM — as did `{ formats: ['csv', 'pdf'], compression: 'gzip' }`. Nothing on
the render path parses, and `ObjectGrid.tsx` reads `schema.exportOptions?.formats`
and only that, so the authored array then lost SILENTLY to the `['csv', 'json']`
default: the `useEffect` that warns about dropped formats reads `.formats` too
and returns early when it is absent, while `!!schema.exportOptions` kept the
export button on screen. An author declared `['csv', 'xlsx']` and got csv/json
with no error, no warning and no console line. The two authoring faces disagreed
in the direction opposite to objectui#6956's: the TypeScript interface already
declared the object form only, so TS refused what zod admitted.

**Why the object arm alone, and not the spec union.** The sibling `list-view`
mirror binds `SpecListViewSchema.shape.exportOptions` whole, and is right to:
that reference is a two-arm union whose first arm LIFTS a bare array to
`{ formats }` at parse, and `list-view` reads both spellings. Binding it here
would make this mirror accept and lift — the opposite of the refusal this card
rules. So the object arm is peeled out of that union and the lifting arm left
behind. Every member schema is the spec's own object (identity-pinned), so a
spec-side change moves this member with it and no third copy of the five keys
exists to drift.

**Who is NOT affected.** A node authoring `{ formats: ['csv', 'json'] }` or any
combination of the five spec keys (`formats` / `maxRecords` / `includeHeaders` /
`fileNamePrefix` / `streaming`) is untouched and its values come back verbatim;
a node with no `exportOptions` is unchanged; `list-view` documents are entirely
unchanged, including the bare-array spelling that still lifts there. Nothing
that renders today stops rendering: the refused spelling was already a silent
no-op at runtime, so the narrowing costs no working artefact. `packages/plugin-grid`
is untouched — the renderer's read was ruled correct and this is the declaration
catching up to it.

**Migration:** write the object form — `exportOptions: { "formats": ["csv",
"xlsx"] }` instead of `exportOptions: ["csv", "xlsx"]`. Delete `'pdf'` (the
surviving formats are `'csv'`, `'xlsx'` and `'json'`) and any key outside the
five above; `os migrate meta --from 16` lists the mechanical edits.

Graded `minor`, not `patch`: this narrows the accepted input set, which is
breaking for any author who wrote the tolerated spelling. It is not `major` per
this repo's fixed-group convention (objectui's own breaking changes ship as
`minor`; the group's major tracks `@objectstack` — AGENTS.md 版本号策略,
mechanically enforced by `scripts/check-changeset-no-major.mjs`).
