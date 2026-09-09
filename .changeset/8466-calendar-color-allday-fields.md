---
'@object-ui/types': minor
---

Declare the two flat calendar field-name keys the renderer already reads and the
package README already teaches — `colorField` and `allDayField` on
`ObjectCalendarSchema` (objectstack-ai/objectui#8466).

`ObjectCalendar.tsx`'s `getCalendarConfig` reads FIVE flat keys off the node, and
`packages/plugin-calendar/README.md` teaches all five in one sentence — "point
`titleField` / `startDateField` / `endDateField` / `allDayField` / `colorField`
at your own fields when they differ." Only three of the five were declared. The
other two reached the renderer through `BaseSchema`'s `[key: string]: any` on the
TypeScript face and its `.passthrough()` on the zod mirror: admitted, never
examined. A misspelling therefore left the calendar silently colourless while
every published gate passed.

`colorField` is derived from the spec's `CalendarConfig`, the same type the
`calendar` block carries, so the flat spelling cannot drift from the block
spelling — the pattern objectstack-ai/objectui#6051 established for
`ObjectGanttSchema.colorField` on this same file, for the same key name and the
same mechanism. `allDayField` is objectui-local and has no `CalendarConfig` twin
to derive from, so it is declared as `string`; it is load-bearing in the renderer
since objectstack-ai/objectui#8026.

Declaring `allDayField` widens no accept set, which is why Commandment #0.1 is
not engaged. Measured on `@objectstack/spec` 17.3.0:
`ComponentPropsMap['object-calendar']` refuses ALL FIVE flat keys with
`unrecognized_keys` — `titleField`, `startDateField` and `endDateField` included,
and those three have shipped declared here for releases. The flat face is
objectui's own lane, kept deliberately: the mirror's `.passthrough()` names this
very key as its reason. Under an index signature and a `.passthrough()` that
already admit any value, a declaration cannot widen anything — it only narrows.

Nor is `allDayField` a new precedent here: `CalendarViewSchema` — the sibling
`calendar-view` element, drawn by the SAME renderer, since `plugin-calendar`
registers `ObjectCalendarRenderer` under both type names — has shipped all five
of these keys declared, `allDayField` included. `ObjectCalendarSchema` was the
odd one out, and the accompanying pin keeps the two interfaces from forking
again.

Both members are optional on both faces, so no node that omits them changes
verdict, and nothing that validated before is refused now. What does change
verdict is a WRONG-TYPED value at a correctly spelled key, which the index
signature and `.passthrough()` used to admit unexamined: `colorField: 0xff0000`
and `allDayField: true` — the field-name-versus-value confusion these keys invite
— are now refused at authoring time and through `safeValidateSchema`, the path
the CLI's `validate` / `check` take. That is why this is a `minor` and not a
`patch`.

Neither key is added to `plugin-calendar`'s registration `inputs`, deliberately:
the forward direction of `apps/console`'s registry/spec parity gate refuses an
`inputs` entry the spec props schema does not accept, and all five flat keys are
refused there. The three sibling keys are absent from `inputs` for the same
reason.

The `BaseSchema` index-signature ceiling measured by
objectstack-ai/objectui#7927 is unchanged — a MISSPELLED key is still admitted on
both faces, and the accompanying pin asserts that rather than claiming otherwise.
