---
'@object-ui/types': minor
'@object-ui/react': patch
'@object-ui/layout': patch
'@object-ui/app-shell': patch
---

`BaseSchema.ariaLabel` declares the keyed i18n vocabulary the renderer actually
resolves, `.disabled` accepts the predicate string it actually evaluates, and the
keyed shape finally has a name (objectui#4581)

Three slots on one base type had drifted from what the renderer does with them.
PR #4593 fixed `visible` and measured the rest; these are the rest.

`ariaLabel` was `string`, but `SchemaRenderer.tsx:111` resolves it with
`resolveKeyedI18nLabel`, whose input is the KEYED form
`{ key, defaultValue?, params? }` — a reference into a translation bundle. It is
now `string | KeyedI18nLabel`, and `KeyedI18nLabel` is a new exported type in
`@object-ui/types` rather than a fourth inline copy of one object literal: the
three that existed (`@object-ui/react`'s resolver, `@object-ui/layout`'s
`resolveLabel`, `@object-ui/app-shell`'s `t`-taking twin) were verified identical
in their object half first, and two of them now import the name.

The vocabulary matters more than the widening. `#4581` originally asked for
`string | I18nLabel`, and that spelling was withdrawn as measured-wrong: the
spec's `I18nLabel` is the INLINE LOCALE MAP (`string | Record<string, string>`),
a different vocabulary resolved against a BCP-47 locale by a different function
of a confusingly similar name. Under it the shipped keyed fixture type-checked
only vacuously — as a locale map whose "locales" are named `key` and
`defaultValue` — the same label carrying `params` was rejected outright, and a
genuine `{ en: 'Owner' }` compiled while rendering an EMPTY `aria-label`. Naming
the keyed shape is the declaration half of the fix objectui#4167 started on the
naming side; `@object-ui/app-shell`'s copy keeps its inline spelling for now
because an open PR has a pending change to that file, and the comment there says
so.

`disabled` was `boolean` on a key the renderer never reads as one:
`SchemaRenderer.tsx:466` evaluates it through the same `evaluateCondition` as
`visible`, and a `disabledOn?: string` sibling exists for the same reason. It is
now `boolean | string`. The asymmetry with `visible` was accidental rather than
deliberate.

Both are widenings on authored-input-dominant properties: authors gain a
spelling, nothing that type-checked before stops doing so, and readers already
coped with `any` through `BaseSchema`'s index signature. Three test fixtures that
had been casting past these declarations with `as unknown as BaseSchema` state
their values directly now, and the declared unions are pinned invariantly so
neither a missing widening nor an overshoot to `any` can pass unnoticed.

`BaseSchema.label` and `.description` are deliberately unchanged and pinned that
way. They receive the spec's inline `I18nLabel` from the view bridges, which is a
real defect, but resolving it belongs at the spec-to-schema boundary rather than
in this declaration — and that work is still blocked on a design question about
where the display locale enters, so it is not in this release.
