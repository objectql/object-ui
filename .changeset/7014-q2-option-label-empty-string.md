---
'@object-ui/app-shell': patch
---

Field designer: clearing a picklist option's **Label** no longer produces metadata the
API refuses (objectui#7014 Q2).

`ObjectFieldInspector`'s option writer guarded the key on truthiness —
`if (o.label) out.label = o.label;` — so an empty Label box was serialised as an option
with **no `label` key at all**. Measured on `@objectstack/spec` 17.2.0,
`SelectOptionSchema` accepts `{ value: 'alpha', label: '' }` and rejects
`{ value: 'alpha' }` with `invalid_type` at `[label]`: the guard was taking a document
the platform accepts and rewriting it into one it refuses, and the save came back 422
with nothing on screen to explain it.

The writer now emits `label: o.label ?? ''` — the value the author actually holds,
empty string included. Nothing is invented: an emptied label stays empty rather than
falling back to the option's `value`, and the author-facing surface is now exactly as
wide as the contract instead of narrower. The `??` arm also covers an option that
arrived without a usable label (a missing or non-string stored `label`, which
`readOptions` maps to `undefined`) — there is no legal document that omits the key, and
`''` is what the Label input has been displaying for that option all along.

Pinned in `ObjectFieldInspector.optionLabel.test.tsx`, which ends each case at
`SelectOptionSchema` / `FieldSchema` rather than merely asserting the key is present —
the point of the fix is that the contract accepts what the designer emits.
