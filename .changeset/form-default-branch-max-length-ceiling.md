---
'@object-ui/components': patch
---

The built-in form's `default` fallback branch now enforces a declared `max_length` ceiling.

The last arm of the field switch — the one serving a `type` that is neither a
built-in field type nor resolvable from the registry — spread its props straight
onto the rendered `Input` and never read the declared ceiling. One declaration
therefore split into two outcomes depending on how it was spelled. Measured on
`main` after objectui#5201 landed:

    max_length: 50 -> attrs=["class","max_length",...]  maxlength=null
    maxLength: 50  -> attrs=["class","maxlength",...]   maxlength="50"

The camelCase spelling capped by coincidence — it happens to name a real DOM
attribute. The legacy `max_length` capped nothing at all and landed as a stray,
inert `max_length="50"` attribute: invalid HTML that reads like a working cap to
the next reader. Two independent defects, both now fixed.

`max_length` is a live authoring spelling, not a fossil: the registered `field:*`
widgets have dual-read `maxLength ?? max_length` since framework#1878 §3, all
three producers of a form field normalize it (`ObjectForm`, `sectionFields`,
`EmbeddableForm.applyDefaultMaxLengths`), and `@object-ui/types` declares it on
several field types. This branch serves a hand-authored `FormSchema` handed
straight to the renderer, where there is no normalizing producer in between and
the author is the producer — so it was the one reader in the repo that dropped
the declaration.

Same defect and same fix shape as objectui#5201 (the `input` arm) and
objectui#3439 (the `textarea` arm): the ceiling is resolved locally inside the
branch, and the legacy key is destructured off locally. The shared
renderer-only strip table is deliberately unchanged — it feeds the `checkbox`,
`switch` and `select` arms too, and widening it would alter branches this change
does not test.

A field that declares no ceiling in either spelling renders no `maxlength`
attribute, exactly as before.
