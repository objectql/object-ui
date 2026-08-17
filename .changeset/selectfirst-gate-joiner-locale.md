---
'@object-ui/components': patch
'@object-ui/fields': patch
---

The dependency-gate hint now enumerates its controlling fields with the locale's
own list separator, and reads identically whichever caller produced it.

`lookup.selectFirst` and `fields.options.selectFirst` are deliberately one
wording, so a field gated on two or more parents says the same thing whether the
lookup widget or the form renderer rendered it. The sentence was shared but its
`{{fields}}` slot was not: each call site joined the controlling-field names
with its own hardcoded separator, and not even the same one — `', '` in
`LookupField`, `' / '` in the form renderer's `gatedHint` and in
`OptionsEmptyState`. A field gated on Account and Lead Source read
`Select Account, Lead Source first` from one side and
`Select Account / Lead Source first` from the other.

A list separator is a property of the locale rather than of the code, so both
spellings were also wrong for the script under zh/ja (which enumerate with
U+3001) and under ar (U+060C). All three call sites now read
`validation.formInvalidJoiner` — the key already shipped in all ten packs for
the invalid-submit toast's field list, which is the same class of truncated-name
list. One key, every caller: a second, gate-specific key would have recreated
the divergence the shared sentence exists to prevent.

No locale pack changes, and no change to what a provider-less render produces in
English: the `@object-ui/fields` defaults table declares the joiner as `', '`,
the `en` pack's value and the literal `LookupField` previously hardcoded.
