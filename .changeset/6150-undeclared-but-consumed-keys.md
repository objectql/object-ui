---
'@object-ui/types': minor
---

Declare the 13 renderer-read keys that no shipped type declared (objectui#6150)

**This is a published-surface change on `@object-ui/types` and its `zod` mirrors,
and it moves the accept set in TWO directions.** Read the next two paragraphs
before reading the list — they are what the change actually is.

**Key membership is NOT widened — it was never narrow.** All eight touched mirrors
extend `BaseSchema`, which is `.passthrough()`, and `.extend()` carries that policy
through (measured on the built mirrors: `catchall` is `z.unknown()` on all eight).
So before this change every one of the 13 keys already parsed green and already
SURVIVED the parse — admitted unexamined, neither refused nor stripped. Nothing
that parsed before stops parsing because a key became known.

**Value enforcement IS widened, which in the value dimension is a NARROWING.** For
the 12 keys that gained a zod mirror entry, the value is now validated against the
declared type: `{ type: 'text', content: 42 }` parsed green before and is refused
now, at `content`. That is the point of declaring them — `declared === enforced` —
but it is a behaviour change for documents that carried a wrong-typed value under
one of these 13 names. Keys OUTSIDE the 13 are untouched: an undeclared key of any
type is still admitted unexamined on all eight mirrors, pinned per mirror.

The 13, each with the renderer read site the declaration records:

| type | key | declared as | read at |
|---|---|---|---|
| `TextSchema` | `content` | `string` | `renderers/basic/text.tsx` — `{schema.content \|\| schema.value}` |
| `CarouselSchema` | `opts` | `Record<string, unknown>` | `complex/carousel.tsx` — `opts={schema.opts}` |
| `CarouselSchema` | `orientation` | `'horizontal' \| 'vertical'` | `complex/carousel.tsx` |
| `CarouselSchema` | `itemClassName` | `string` | `complex/carousel.tsx` — per-slide class |
| `FilterBuilderSchema` | `wrapperClass` | `string` | `complex/filter-builder.tsx` |
| `TreeViewSchema` | `nodes` | `TreeNode[]` | `data-display/tree-view.tsx` |
| `TreeViewSchema` | `title` | `string` | `data-display/tree-view.tsx` |
| `TreeViewSchema` | `onNodeClick` | `(node: TreeNode) => void` | `data-display/tree-view.tsx` — INVOKED |
| `CheckboxSchema` | `required` | `boolean` | `form/checkbox.tsx` — drives the `*` marker |
| `FileUploadSchema` | `buttonText` | `string` | `form/file-upload.tsx` |
| `FileUploadSchema` | `wrapperClass` | `string` | `form/file-upload.tsx` |
| `HoverCardSchema` | `align` | `OverlayAlignment` | `overlay/hover-card.tsx` |
| `ContextMenuSchema` | `trigger` | `SchemaNode \| SchemaNode[]` | `overlay/context-menu.tsx` |

These compiled before only because `BaseSchema` ends with `[key: string]: any`
(objectui#5155), so the docs page was the single place in the repo recording each
capability, and the one place with no mechanical guard.

Three declarations are deliberately not what "declare what is read" would produce
on its own, and each says so in its own doc comment:

- `CarouselSchema.opts` stays an OPEN bag rather than the docs page's
  `{ loop?, align? }` pair. The renderer forwards the whole bag to embla, so
  narrowing it to two keys would refuse authored documents that work today.
- `ContextMenuSchema.trigger` is OPTIONAL although the docs page shows it
  required; the renderer substitutes a placeholder, so trigger-less documents are
  legal today.
- `TreeViewSchema.onNodeClick` gets NO zod mirror. It is invoked, not read as a
  value, so it cannot appear in an authored JSON document; objectui#6152 ruled
  that class is recorded in `zod-mirror-parity.test.ts`'s `RuntimeOnlyDeclared`
  instead, and it is (the first pair to sit there without also sitting in
  `UnmirroredDeclared`, so that file's two counts move with it).

Two of the 13 declare a SECOND spelling for a slot that already had one —
`TextSchema.content` beside `value`, `TreeViewSchema.nodes` beside `data` — because
that is what the renderers read. Retiring either spelling is an ADR-0049
enforce-or-remove question and is deliberately not decided here. Declaring `nodes`
also does not by itself make a `nodes`-only tree-view document legal: `data` stays
required on both faces.
