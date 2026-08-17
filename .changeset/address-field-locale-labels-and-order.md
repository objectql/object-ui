---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

`AddressField` is translatable, shows no US example placeholders, and formats its readonly line in the reader's address order.

The five sub-labels ("Street Address", "City", "State / Province", "ZIP /
Postal Code", "Country") were English string literals with no i18n key. On a
non-English console every address field showed five English words in the middle
of an otherwise fully translated form, and an app had no way to reach them: the
parts are not fields on the object (`billing_address` is a single `address`
column), so a translation bundle had nothing to key on, there is no `subLabels`
property to declare, and the widget cannot be replaced from metadata. They now
resolve through `fields.address.street` / `.city` / `.state` / `.postalCode` /
`.country`, added to all ten locale packs. The `en` values are byte-identical to
the literals they replace, and `FIELD_DEFAULTS` carries the same five, so
English and provider-less rendering are unchanged.

The five input placeholders (`123 Main St`, `San Francisco`, `CA`, `94102`,
`United States`) are **removed** rather than keyed. They were untranslated and
US-specific — a zh/ja/ar user was shown an American address as the example of
what to type — and the right example is a function of the address's country,
not the reader's language, which no channel in the stored value can supply
today. Each box keeps the visible label that names it.

The readonly line's part order now follows the reader's display locale
(`useDisplayLocale()`): `zh`, `ja` and `ko` read largest-first (`Country, ZIP
State, City, Street`), every other locale keeps the unchanged small-to-large
order (`Street, City, State ZIP, Country`). The display cell renderer takes the
same locale through the same shared `formatAddress`, so a stored address reads
identically in a readonly form and in a grid cell.
