---
'@object-ui/components': patch
---

The built-in form `input` branch now honours a declared ceiling in both authored spellings.

The branch spread its leftover field props straight onto the element and never
read the declared ceiling, so one declaration produced two different outcomes.
Measured on `origin/main`, rendering the built-in branch (no `registerAllFields()`)
and dumping the element's `getAttributeNames()` / `getAttribute('maxlength')`:

| declaration | `maxlength` on the element | effect |
|---|---|---|
| `maxLength: 50` | `"50"` | capped — but only by the coincidence that `maxLength` names a real DOM attribute |
| `max_length: 50` | `null`, plus a stray `max_length="50"` | no cap at all, and invalid HTML |

Two distinct defects: the missing cap, and an inert attribute on the DOM that
reads like a working cap to whoever greps the file next.

`max_length` is a live authoring spelling, not a fossil. The registered
`field:*` widgets have dual-read `maxLength ?? max_length` since framework#1878
§3, all three producers of a form field normalize it (`ObjectForm`,
`sectionFields`, `EmbeddableForm.applyDefaultMaxLengths`) and `@object-ui/types`
declares it on several field types. Every reader in the repo honoured it except
this branch — which is precisely the one serving a hand-written `FormSchema` fed
straight to the renderer, where no producer sits in between to normalize it and
the author is the producer. This is the same mechanism objectui#3439 resolved
for the built-in `textarea` branch.

The legacy key is destructured off locally rather than added to the shared
`stripRendererOnlyProps` list: that helper feeds every branch
(`checkbox`/`switch`/`select`/`default` all share `domFieldProps`), so extending
it would change what reaches the DOM for widgets this change neither fixes nor
tests. The neighbouring `textarea` branch strips it the same local way.

Scope, stated because the sibling card resolved more than this one: the ceiling
only. Whether a single-line input should also carry the visible `{n}/{max}`
counter and the announced limit that the `textarea` branch grew in
objectui#3439 is an independent design trade-off that does not follow from that
card's conclusion, and is deliberately left undecided here.
