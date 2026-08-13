---
'@object-ui/fields': minor
'@object-ui/plugin-grid': patch
'@object-ui/plugin-gantt': patch
---

The date formatter's last three en-US channels now follow the display locale
(objectui#4272).

objectui#4468 (PR #4512) pointed every date *renderer* at `useDisplayLocale()`.
Three channels were out of its reach because they are properties of the
formatter's signature and of its callers rather than of any renderer, so a `zh`
console still met English dates in three places:

- **`formatDate`'s `'short'` branch** hardcoded
  `toLocaleDateString('en-US', { month: 'short' })`, so it rendered an English
  month even when the caller had threaded `options.locale` into that very call.
  Its only consumers are ObjectGrid's two mobile-card date cells, which threaded
  no locale — fixing either half alone moves nothing, so both land here.
- **`formatDateTime` took no options parameter at all**, so no caller could
  localize it however hard it tried; it always handed `Intl` an `undefined` tag,
  which means the MACHINE's locale — neither of the repo's two locale channels.
  The parameter is optional and lands together with its consumers, plugin-gantt's
  four tooltip call sites.
- **The lookup picker's MongoDB `$date` fallback** called a bare
  `toLocaleDateString()` with no tag.

One resolver everywhere, as before: `useDisplayLocale()` (tenant regional
default → active UI language → `'en'`). `Intl` accepts `'zh'` verbatim, so there
is still no mapping table anywhere.

English output is byte-identical at every touched site — `en` and `en-US` agree
on all twelve short month names — and the `'short'` layout itself is unchanged:
only the month token is localized, the compact `"Jan 15, '24"` shape around it
is a deliberate fixed layout for narrow cards.

`@object-ui/fields` is `minor` because `formatDateTime`'s new optional parameter
is visible in the package's entry `.d.ts`; the plugin packages' own `.d.ts` files
are byte-identical, so their change is module-local.
