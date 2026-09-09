---
'@object-ui/types': patch
---

Refuse `actions` by name on the `page` node (objectui#7926, maintainer ruling
2026-09-09, decision batch #107 item 2 — option A).

**Accept-set change, deliberately.** A `page` document carrying `actions` used to
parse GREEN and render nothing. `PageNodeSchema` never declared the key and
`PageRenderer` never read it — `git grep -ni action` on
`packages/components/src/renderers/layout/page.tsx` returns only the
`PageVariableActionBridge` import and its render — so the array survived purely
through `BaseSchema`'s `.passthrough()`. Measured through the real
`SchemaRenderer`: a `page` node with `actions: [{type:'button',label:'Add
Product'}, …]` drew **0** buttons and the label appeared nowhere in the DOM,
while the SAME two buttons in `body` drew **2**. Until objectui#7933 the array
also reached the wrapper element as `actions="[object Object],[object Object]"`.

`PageNodeSchema` now declares `actions` as an ADR-0049 refusal arm, so the same
document fails at parse with the remedy in the message. The TypeScript twin is
`actions?: never`, so `tsc` refuses it at the authoring site before anything runs.

**Why a refusal and not a reader.** This was the third surface carrying an
`actions` array no reader consumes (objectui#7469 — the app node; objectui#7693 —
the alert-dialog fixtures), and the authorable action FORM was already ruled on
2026-08-25 for objectui#6497 / #6182: the declarative action object. Growing a
reader here would have minted a fourth `actions` shape.

**Migration.** Put the buttons in `body` as nodes — a `button`, or an
`action:button` with a declared `actionType`:

```json
{
  "type": "page",
  "title": "Products",
  "body": [
    { "type": "flex", "justify": "end", "gap": 2, "children": [
      { "type": "button", "label": "Add Product", "variant": "default" }
    ] }
  ]
}
```

On a record page the second door is the `page:header` block, whose own `actions`
are **action ids** resolved from the object's metadata (objectui#7182), not nodes
— that channel is unchanged.

**Scope.** One key, by name; the node is NOT strict. A census over this tree read
91 authored `page`-tagged objects with a blind-spot reading of 8 unreadable sites,
and found only `actions` (3 sites, all in `content/docs/guide/layout.md`) and
`breadcrumbs` (1 site, its own question, untouched) surviving passthrough on a
real `page` node — every other undeclared key belongs to a different declaration
that merely spells `type: 'page'`. `PageNodeSchema` still passes unknown renderer
props through.

The three teaching passages in `content/docs/guide/layout.md` are rewritten onto
the shape that draws, and pinned by their rendered result rather than their text.
