---
'@object-ui/plugin-calendar': minor
---

`object-calendar` now READS the `allDayField` it already resolved (objectui#8026).

**The defect.** `getCalendarConfig` put `allDayField` into the `CalendarConfig` it
returns, and the memo that builds that config named the key among its dependencies —
but the events pass destructured four keys and computed the flag as `!endDate`. An
author who wrote `calendar: { allDayField: 'is_all_day' }` therefore got the flag
derived from whether the record happened to carry an end date, and a record with a
real end date that IS flagged all-day rendered as an ordinary timed event, with no
diagnostic. The value was arriving: `ListView`'s `collectViewFields` already collects
this field into the fetch, and `ObjectView`'s `calendarViewOptions` forwards the
authored `calendar` block verbatim.

**No default field name — the deliberate divergence from `calendar-view`.** The
sibling `calendar-view` renderer spells `schema.allDayField || 'allDay'`.
`object-calendar` does **not** take that default, and an unauthored `allDayField`
changes nothing: the existing `!endDate` inference stands, so every calendar that
never declared the key renders exactly as before. The sibling's five field-name
defaults describe the canonical authored EVENT shape a `calendar-view` node carries
in its `data`; `object-calendar` draws ObjectQL records of a business object, where
nothing makes `allDay` a field name — and this renderer honours none of those five
defaults, refusing rather than guessing when `startDateField` is absent
(objectui#7029). Importing one of the five would put the last fabricated field
binding back into the renderer whose refusal screen exists to refuse guessing.

**Behaviour change, scoped.** Only calendars that DID author `allDayField` change,
and they change in the direction the declaration asked for. Where the key is
declared it is now the whole answer: a record whose flag is absent or false is not
all-day, because letting the inference run behind a declared key would silently
overrule the author.

**Not spec surface.** `@objectstack/spec`'s `CalendarConfigSchema` is a strict object
of four keys and refuses `allDayField` by name — the same way it refuses objectui's
own sanctioned `defaultView`. The key rides objectui's deliberate `.passthrough()` on
the `CalendarConfig` mirror in `@object-ui/types`, whose comment names it: "the
renderers grow config knobs ahead of the protocol (calendar's `allDayField`, for
one), and stripping them here would silently disable a shipped capability." Nothing
in this change widens any accept set.
