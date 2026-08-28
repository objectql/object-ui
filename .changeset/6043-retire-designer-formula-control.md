---
'@object-ui/types': minor
'@object-ui/plugin-designer': minor
'@object-ui/app-shell': minor
---

The Field Designer no longer offers a formula-expression textarea, and no designer write
path emits a `formula` key (objectui#6043).

**This is a behaviour change on an authoring surface: a control is removed.** A field's
`type` may still be set to `formula` — that is a valid spec `FieldType` and stays in the
palette — but the expression itself is no longer authored here. Authors write formula
expressions in metadata-admin's field inspector, where they are checked.

The control wrote `formula`, which is not in `FieldSchema`'s accept set. Measured against
the installed `@objectstack/spec` 17.2.0:

```
FieldSchema.safeParse({ type:'formula', label:'Tax', formula:'price * quantity' })
  => success = false
  => unrecognized_keys ['formula']   "Did you mean `formula` -> `expression`?"
```

so `PUT /api/v1/meta/object/:name` returned a hard 422 `INVALID_METADATA` — and because
the key was then stored, it blocked **every later save of that object**, not just the one
that introduced it.

**The key was deliberately NOT renamed to the spec's `expression`.** `FieldSchema` judges
the key name and never the expression LANGUAGE — measured, it accepts
`expression: 'price * quantity'` and even `expression: '!!!not cel at all!!!'`; only the
empty string is refused. Spec `expression` is CEL rooted at `record`
(`record.amount * 0.1`), whereas this control's own placeholder taught `price * quantity`
— bare field refs, which under the scope formulas bind evaluate to null silently. A rename
would therefore have converted a loud, immediate 422 into a formula that saves clean and
then quietly computes nothing, which is strictly worse than the bug it appears to fix.

Making refusals loud *in the control* would need CEL lint, autocomplete and `returnType`
inference — that is `CelPredicateField`, which lives in `@object-ui/app-shell`, and
app-shell depends on `@object-ui/plugin-designer`, so it cannot be imported back without a
dependency cycle. Growing a second formula-authoring surface inside plugin-designer is a
feature, not this fix. `returnType` is likewise not authored here: it is only derivable by
inferring the CEL result type, and with no expression control there is nothing to infer
from.

`formula` joins the retired-key tombstone in `MetadataFieldsPage`, so an object already
carrying the key is stripped clean on its next save instead of staying blocked forever —
which matters more than usual here, because with the control gone an author would
otherwise have no way left to clear it. It is dropped rather than migrated to `expression`,
for the same reason the rename was refused. A `expression` authored in metadata-admin is
**not** touched: it is a real `FieldSchema` key and rides through the designer's
round-trip untouched.

Also removes the now-unreachable `formula` read/write from
`views/metadata-admin/previews/object-fields-bridge.ts`, which was a third emit site for
the key that neither the card nor the parity gate named.

The `formula` entry is removed from `check-designer-field-key-parity.mjs`'s
`KNOWN_UNPARSEABLE_KEYS` ledger, which ratchets in both directions — a resolved key that
left a stale entry behind would be as red as a new offender.
