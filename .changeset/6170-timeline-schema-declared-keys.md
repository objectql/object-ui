---
'@object-ui/plugin-timeline': minor
'@object-ui/types': minor
---

`TimelineSchema` now declares the presentational keys the timeline renderer actually reads
(objectui#6170, maintainer ruling 2026-08-25 — the same family rule adopted on
objectui#6172: the exported type aligns to the measured authored + read set).

Before this, `TimelineSchema` declared `events` (required), `orientation` and `position`,
and nothing else. `TimelineRenderer` is annotated `schema: TimelineSchema` and reads nine
keys off that node — `variant`, `items`, `dateFormat`, `onItemClick`, `minDate`, `maxDate`,
`rowLabel`, `scale`, `timeScale` — and **none** of the three that were declared. The docs
property table and the registration's own designer `inputs` had agreed with the renderer
all along; only the exported type disagreed. It was invisible to `tsc` because `BaseSchema`
carries `[key: string]: any`, so every undeclared key resolved as `any` and the annotation
constrained nothing.

The most visible casualty was the docs page's own TypeScript example, which did not
compile: `Property 'events' is missing in type '{ type: "timeline"; variant: string; items:
… }' but required in type 'TimelineSchema'`. The page taught an authoring form its own
published type refused.

**Declared now** (TS interface and the `@object-ui/types/zod` mirror together): `variant`,
`items`, `dateFormat`, `scale`, `timeScale`, `rowLabel`, `minDate`, `maxDate`. `onItemClick`
is deliberately left undeclared — it is a runtime slot `ObjectTimeline` installs, and this
package keeps callback-shaped keys off the authored surface.

**`scale` is the canonical axis key.** It is `@objectstack/spec`'s `ui/TimelineConfig.json`
spelling and the one `resolveTimelineScale` reads first (`scale ?? timeScale`). The designer
now offers it, with all six buckets: `hour` / `quarter` / `year` have rendered correctly
since objectui#2942 but were offered by neither the designer (which listed three) nor the
exported type (which listed none), so they were authorable and undiscoverable. `timeScale`
stays as a deprecated alias so stored JSON keeps working; retiring it is routed separately.

**`events` is now optional.** It was required, which is why the documented authoring form
did not type-check. That widening is the only non-additive change here — strictly more
programs compile and strictly more input parses than before. `events`, `orientation` and
`position` remain declared and remain read by nothing; a timeline authored with `events`
still renders an empty rail. Their removal is a breaking narrowing of a published type and
is routed through ADR-0049 enforce-or-remove as its own change, not smuggled into this one.

Accept-set note for consumers: keys that previously resolved as `any` are now typed, so a
value the renderer never implemented — `variant: 'diagonal'`, `dateFormat: 'medieval'`,
`scale: 'fortnight'` — is a type error and a Zod rejection where it used to pass silently.
Nothing that renders today stops rendering. `BaseSchema`'s index signature is untouched, so
an undeclared key is still accepted by both halves (objectui#5155 / objectui#6269 own that
ceiling).
