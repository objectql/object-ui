---
'@object-ui/fields': minor
---

One home for the `date` display convention in the readonly field widgets
(objectui#8194).

Four readonly `date` faces in `@object-ui/fields` called
`toLocaleDateString(locale)` with **no options bag at all** — `Intl`'s numeric
default — so they never implemented the year-dropping decision the shared
`formatDate` documents and every `date` CELL already follows. They now call
`formatDate` (default style):

- the readonly `DateField` (the form / detail face, and what `FieldEditWidget`
  renders in the grid and detail inline editors),
- the sub-grid `GridField`'s readonly `date` column,
- a `FormulaField` declaring `return_type: 'date'`,
- the lookup picker's plain-text `$date` fallback (`lookupColumnDisplay`),
  which sits in the same function as the descriptor path that already rendered
  through `formatDate`.

**Visible change**: every one of those faces changes shape in every locale, in
every year — not only the year token. In `en-US` a date renders `Jul 4` this
year and `Jul 4, 2024` for a past year, where it used to render `7/4/2026` and
`7/4/2024`; in `de` `4. Juli` / `4. Juli 2024` for `4.7.2026` / `4.7.2024`; in
`zh` and `ja` `7月4日` / `2024年7月4日` for `2026/7/4` / `2024/7/4`; in `ar`
`4 يوليو` / `4 يوليو 2024`. Each now matches the `date` cell beside it. This is
a larger move than the sibling change in `@object-ui/components`
(objectui#7620), whose former face already asked for a short month and so only
lost its year token — these four passed no bag whatsoever.

A value the formatter cannot parse now reads `—` at three of the four sites
instead of the literal `Invalid Date`. The sub-grid keeps showing the raw
stored string for an unreadable value, unchanged (objectui#3569).

Untouched: the `datetime` readonly faces (`DateTimeField`, the sub-grid's
`datetime`/`time` branch). They are the same omission one type over, but their
home is `formatDateTime`, whose named faces are a separate display-convention
question; they are recorded on their own card rather than picked here.

A surface that genuinely wants the year on every row is an explicit `format`
style honoured by both paths, not a second option bag — the objectui#7620 /
objectui#7443 / objectui#4576 lesson, one surface over.
