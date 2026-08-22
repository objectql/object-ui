---
'@object-ui/components': patch
---

`element:record_picker`'s `label` and `placeholder` now resolve the inline
per-locale map their contract admits, and their published declarations say so
(objectui#5637).

These are the two remaining keys of the trio objectui#5590 fixed one of. All
three members of `ElementRecordPickerPropsSchema` are the `I18nLabel` union
(`string | Record< string, string >`) — measured on the installed
`@objectstack/spec` 17.1.0 pin, where each resolves to
`optional -> union -> string | record` and
`safeParse({ object: 'account', <key>: { en, 'zh-CN' } })` succeeds. The
renderer honoured only the string arm on both, and the two keys failed in two
different ways:

- `placeholder` was read raw and handed to `SelectValue`. React refuses a plain
  object in that position rather than stringifying it, so the whole picker
  subtree threw
  `Objects are not valid as a React child (found: object with keys {en, zh-CN})`
  — the same harm objectui#5590 removed from `emptyText`.
- `label` went through the file's local `toText`, whose object branch ends
  `String(o.label ?? o.name ?? o.title ?? o.en ?? '')`. Reaching `o.en`
  unconditionally is an English pick wearing locale resolution's clothes, so a
  `zh-CN` viewer was shown the English entry — and a map that simply omits `en`
  resolved to `''`, which the `{label && …}` render site drops, making the
  picker's label element DISAPPEAR with nothing thrown and nothing logged.

Both keys now resolve at their own read site through `pickLocalized`, the same
helper the settled `emptyText` shape uses. `toText` is deliberately unchanged:
it is shared with the row values (`toText(row?.[labelField])`), which are record
field values rather than `I18nLabel`, so teaching it locale resolution would
have changed a second, unrelated call site. The `placeholder` default is applied
before resolution, so an absent key still means "Select a record…" and an
authored empty string still renders empty.

The two `ComponentMeta` entries, which held a single `'string'` arm precisely
because the renderer dropped the other one, now declare `['string', 'object']`
— declared in the change that makes the arm render, never before, which is the
order `ComponentInput.type` prescribes and the order `emptyText` set.

KNOWN GAP, unchanged by this release: the sibling `label` read sites in
`renderers/layout/containers.tsx` compose
`translateLabel(pickLocalized(…), language)`, and that second helper is not
applied here — `translateLabel` and its `KNOWN_LABEL_DICT` are module-private to
that file. Only the locale-map resolution lands in this change; a plain-English
string `label` is still rendered verbatim in every language, exactly as before.
