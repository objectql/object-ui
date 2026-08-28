---
'@object-ui/plugin-dashboard': patch
---

The dashboard package now holds ONE relation predicate instead of two that
agreed only because a sweep had just aligned them (objectui#5876).

`computeLookupExpand` in `ObjectDataTable.tsx` carried its own `isLookup`,
byte-identical to the exported `isLookupType` in `recordFields.tsx` after
objectui#5692 pointed both at `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`.
Nothing kept them aligned: a future edit to either — a member added, the
retirement gate moved — would have re-forked the `$expand` decision from the
predicate whose docblock claims to drive it. `computeLookupExpand` now calls
`isLookupType`, which gains its first production consumer, and the module no
longer imports the shared family or the retirement gate at all.

**No behaviour changes**, and that is measured rather than assumed:

- The two bodies were identical, so every boolean answer — `tree` is expanded,
  `reference` is not, ordinary relations are — is the same before and after.
- The retired-spelling warning is not emitted a different number of times.
  `reportRetiredFieldType` dedupes per SPELLING in one module-level set inside
  `@object-ui/core`, which both bodies already shared, so routing two callers
  through one function cannot change the count.

Nothing published moves: `isLookupType` is not re-exported from
`@object-ui/plugin-dashboard`'s entry, so this is internal shape only.

Because a refactor with no observable delta cannot be pinned by a behavioural
test — a byte-identical local copy satisfies every assertion you can write
about `$expand` — the pin is identity, in
`__tests__/expandableFamily.identity-5692.test.ts`: `computeLookupExpand` is
observed CALLING `isLookupType`, and `ObjectDataTable.tsx` is read at source
level to confirm no second body survives for it to call instead.
