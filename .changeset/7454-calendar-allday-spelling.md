---
'@object-ui/plugin-calendar': patch
---

fix(plugin-calendar): the all-day lane header reads the same string with or without an I18nProvider

`CalendarView`'s `DEFAULT_TRANSLATIONS` table — the `defaults` map behind its
`createSafeTranslation` factory — spelled `calendar.allDay` as `all-day`, while
all ten locale packs carry the key and `en` spells it `All Day`. Since
`createSafeTranslation` serves that table only when no `I18nProvider` is
mounted, the same lane header rendered `all-day` in a standalone embed and
`All Day` inside the console. The table now matches the pack, so both paths
render one string.

The table entry was the only one of the seven that disagreed with its `en`
value, and the packs predate it by three months — the drift was an oversight,
not a compact spelling chosen for the 56px gutter (both strings are seven
characters wide).

Also removes the dead `t('calendar.allDay') === 'calendar.allDay'` ternary that
guarded the lane header: the factory's provider-less arm returns `defaults[key]`
before it could ever return the bare key, and with a provider the merged
resources always carry `calendar.allDay`, so its lowercase branch was
unreachable from either side.
