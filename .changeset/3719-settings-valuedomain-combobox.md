---
'@object-ui/console': patch
---

Setup's settings selects now follow the specifier's `valueDomain` declaration instead of
treating the curated `options` table as the domain (objectui#3719).

Since objectstack#5712 / PR objectstack#6581 a settings specifier may declare
`valueDomain` (`iana_time_zone` | `iso_4217_currency` | `iso_3166_alpha2`), and when it
does the **standard's membership is the enforcement boundary** — the server accepts
`timezone: 'Europe/Zurich'` and `currency: 'CHF'`, neither of which is in the manifest's
list. The console kept drawing those keys as closed dropdowns, so an admin could author
only the 17 curated zones and 9 curated currencies while the contract took the whole
domain; every other legal value was reachable by API or `OS_LOCALIZATION_*` env only. The
keys' own descriptions had promised "IANA zone" / "ISO 4217 code" all along.

`case 'select'` in `SettingsField` now keys the control off the declaration. Declared →
an editable combobox: the curated options stay on as suggestions (native `<datalist>`, the
same suggest-but-allow-anything affordance `FlowReferenceField` uses — no new dependency),
free text is committed verbatim, and an out-of-domain value is refused by the server with
`invalid_value` + `constraint: { valueDomain }` into the field-error slot that already
exists.

**Undeclared → the closed dropdown is untouched**, which is half the change rather than a
caveat. Those `options` are still exhaustive under objectstack#5131 (the sms/mail provider
selects), and `localization.locale` had its domain declaration deliberately **rejected** in
objectstack#6515 because its options *are* the shipped catalogs. Widening those to free
input would be a regression wearing this fix's clothes, so the two branches are pinned
against each other from the specifier data rather than from a list of key names — a key
that gains a domain server-side joins the right side of the pin with no edit here.

Root cause, because it will recur: `Specifier` in `pages/settings/types.ts` is a
hand-written **local mirror** of the server's shape, not an import, so nothing tells it when
the schema grows — and TypeScript reports nothing, because a narrower mirror is a
structurally valid reading of a wider object. `valueDomain` is added there and the file
header now says to check the mirror first when a settings feature "doesn't render".
