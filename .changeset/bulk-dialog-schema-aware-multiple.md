---
"@object-ui/plugin-grid": patch
---

fix(plugin-grid): schema-aware multi-value semantics for bulk-edit params (#2204)

BulkActionDialog was schema-blind: whether a bulk-edit param rendered a
single- or multi-select — and whether the patch shipped a scalar or an
array — depended solely on the hand-written `BulkActionParam.multiple`
flag. A view author targeting a multi-value field (`multiselect`, `tags`,
`checkboxes`, or `select`/`lookup`/`user`/`file`/`image` with
`multiple: true`) who forgot the flag got a single-select control and a
SCALAR patch, silently corrupting the column shape server-side.

Now the target object's schema is the fallback:

- ObjectGrid passes its `objectSchema.fields` into BulkActionDialog and
  useBulkExecutor.
- An explicit `param.multiple` boolean still wins; otherwise `update`
  params derive multi-ness from the field definition via the new
  `isMultiValueField` helper.
- The executor shape-normalizes every outgoing patch (`run` and `retry`):
  a lone scalar aimed at a multi-value field is wrapped into a
  single-element array — mirroring the server-side guard added in
  framework #2552.
