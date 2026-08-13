---
'@object-ui/fields': patch
'@object-ui/i18n': patch
---

fix(i18n): every date branch threads the active locale, so a `zh` session no longer renders half its dates in English

Date rendering had two locale channels and only one followed the user's
language, so the same row could read `逾期 6 天` in one column and `In 3 days`
in the next, with a datetime column showing `8/11/2026 12:00 am`
(objectui#4468).

The overdue phrase resolves through the translate fn (the active UI language),
while every `Intl` branch took its tag from the raw tenant locale
(`useLocalization().locale`) — which is `undefined` on any workspace that never
configured one, and `undefined` makes `Intl` use the *machine's* locale.
`DateTimeCellRenderer` passed no tag at all.

Every date-formatting site in `@object-ui/fields` now resolves through the one
existing channel, `useDisplayLocale()` (tenant regional default → active UI
language → `en`): `DateCellRenderer` (relative past, relative future, near-today
and the beyond-±7-days absolute fallback), `DateTimeCellRenderer`, the read-only
`DateField` / `DateTimeField` / `FormulaField` faces, and the sub-grid's
temporal cells. English output is unchanged, and the already-localized overdue
wording is untouched.

No public signature changed. `@object-ui/i18n` carries a documentation
correction only: `useDisplayLocale`'s docstring claimed `DateCellRenderer`
already formatted from this channel, which was the very thing that was not true.
