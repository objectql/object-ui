---
"@object-ui/fields": patch
---

The lookup "Browse all records" Record Picker's filter panel now offers the
options a `select` field declares in its schema (objectui#3336). `LookupField`
turns each typed picker column into a filter column, and those carried no
`options` — so the filter panel's dropdown opened EMPTY and the column could
not be filtered at all, even though the same column's table cells had rendered
the authored option labels since objectui#3333.

`RecordPickerDialog` now fills a `select` filter column's missing `options`
from `fieldsMeta` (the referenced object's schema `fields` map) through the
same resolver — and the same i18n option translation — the table cells use, so
the filter dropdown and the cells can never disagree about what an option is
called. Explicitly authored filter `options` still win (including the ones
auto-derived from an `in`/`notIn` `lookup_filters` entry), and a select field
whose schema declares no options keeps an empty dropdown: no options are
synthesised from the loaded page's raw stored values.
