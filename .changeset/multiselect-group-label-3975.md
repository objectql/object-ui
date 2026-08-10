---
'@object-ui/fields': patch
---

A form-hosted `multiselect` field is now NAMED by its visible label. It was the
residual of objectui#3961: that issue's probe audited six widgets and fixed
them, and re-running the same probe over the whole widget map afterwards put
`multiselect` on the byte-identical failure shape as `checkboxes` — the host's
`id` kept, but on the chip row's wrapper `div`, where a `<label for>` is inert
HTML (`HTMLLabelElement.control` is `null`, so it activates nothing and
contributes no accessible name). Measured on the tree that already carried
#3961's fix, one field per row:

```
checkboxes   for=(none) ownId=…-group-label   byLabelText=1(div[role=group])
multiselect  for=…-form-item ownId=(none)     byLabelText=0
```

Visually the field had a "Tags" label; a screen reader heard only "Alpha" /
"Beta" and nothing about what the set of chips was for.

No new mechanism — #3961's declaration, applied to one more widget:
`multiselect` declares `labelling: 'group'` at the registration boundary, so
the form renderer publishes its label's `id` and drops the dead `for`, and the
chip row answers with `role="group"` + the handed-down `aria-labelledby`.

Unchanged on purpose: each chip keeps its own accessible name from its text
content (the group name sits one level up and does not override it), and
STANDALONE rendering — the grid's inline cell editor, a bare SDUI node, where
nobody hands an id and there is no host label to point at — emits no role and
no IDREF, exactly as before.
