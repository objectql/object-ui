---
'@object-ui/app-shell': patch
---

Fix the page designer's `element:definition-list` item controls, which wrote keys
the renderer does not read (objectui#8279).

**Every definition list built in the page designer rendered a blank term and a
literal `—` on every row, whatever the author typed.** The designer's two item
controls were named `label` and `value`; `PageBlockInspector` writes an item key
verbatim, so an author filled `items[i].label` / `items[i].value`.
`DefinitionListRenderer` reads `term` and `description`, and its `toText` returns
the em-dash for an absent value. Nothing reported it: both authored strings stayed
in the document, and `items.length` was non-zero so the renderer's own "No details"
empty state never fired either.

The controls are renamed to `term` / `description` — the producer side, per
AGENTS.md #0.1 and the rule stated in `block-config.ts`'s own file header ("keep
each field `name` aligned with the property name the corresponding renderer
reads"). Two of the three faces already agreed: the block's registry declaration
names `items` as "Term/description pairs `[{ term, description }]`". The designer
was the outlier, so moving the renderer instead would have put it at odds with its
own declaration.

**This changes what the designer emits.** A list authored after this change is
written as `items: [{ term, description }]` and renders the authored text. The
inspector's two boxes are relabelled accordingly in both locale tables, and the
`inline` field's label — which spelled the retired pair in its own prose ("Inline
(label · value)") — follows them.

**Stored documents are left as they are, deliberately.** A definition list saved by
a released build carries the old spelling nested inside `items[]`, and it rendered
blank before this change and renders blank after it — nothing regresses. Its two
authored strings are NOT stripped: the read-door strip that objectui#7772
introduced for `object-kanban.groupField` admits a key only when the node schema
refuses it BY NAME, so that the strip cannot lose anything a consumer would have
honoured, and `element:definition-list` has no runtime-judgeable schema on either
face — nothing refuses these keys, and they hold text an author typed. Stripping an
accepted key deletes authored metadata, which is the one thing that ledger's
membership criterion exists to forbid. The strings stay in the document and stay
readable and editable in the resource editor's JSON source tab; re-typing them into
the two boxes, or renaming the keys in that tab, makes an existing list render.
