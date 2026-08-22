---
'@object-ui/core': patch
'@object-ui/fields': patch
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-view': patch
'@object-ui/plugin-dashboard': patch
'@object-ui/plugin-list': patch
---

A RETIRED field-type spelling is now refused — out loud, once — by every
field-type predicate in the renderer, not just by the widget road
(objectui#4914, maintainer ruling B of 2026-08-18).

`@object-ui/fields` exports a single `isRetiredFieldType(t)` gate, and it runs
ahead of six predicate faces that previously granted a retired spelling
first-class treatment: the filter builder's operator buckets and its value
control (`@object-ui/components`), the detail page's highlight-strip picker
(`@object-ui/plugin-detail`), `normalizeFieldType` (`@object-ui/plugin-view`),
the dashboard's `$expand` whitelist and `isLookupType`
(`@object-ui/plugin-dashboard`), and the list toolbar's lookup-like filter
control (`@object-ui/plugin-list`). Each one now fires the migration
prescription on the console — once per spelling across all of them, never once
per predicate — and then answers as it would for a spelling it does not
recognise.

This closes the whole CLASS rather than one word: the gate is quantified over
`RETIRED_FIELD_TYPES`, so the next retirement covers all seven consumers on the
day it lands. It is the shape objectui#4932 and objectui#4942 already
established for the form and inline-edit roads.

Measured before the change, and the reason the fix is a gate rather than a
deletion: `owner` was not dead in these faces. `operatorsForFieldType('owner')`
equalled the `user` bucket item for item, `computeLookupExpand` actively
requested `$expand` for it, `isLookupType('owner')` was `true` alongside
`reference`, and `normalizeFieldType('owner')` answered `'select'` exactly as
`picklist` does. Deleting the members alone would have traded a visible
contradiction for a SILENT degradation — a filter picker collapsing to a bare id
box, `$expand` quietly stopping so cells show raw foreign-key ids — which is
verbatim the failure mode `RETIRED_FIELD_TYPES`' own docblock exists to prevent.
The gate keeps that fallback and adds the half that was missing: the author is
told.

The boundary question is answered on record: `owner` arriving through a
backend-vocabulary normalizer is an authoring error to refuse loudly, not
legitimate foreign input to tolerate. The open backend vocabulary those
normalizers exist for is untouched — `reference`, `picklist`, `money`, `int`,
`datetime_tz` and the rest are equally absent from the spec's closed `FieldType`
and are equally unretired, so they classify exactly as before.

`RETIRED_FIELD_TYPES`, `reportRetiredFieldType` and `resetRetiredFieldTypeReports`
move to `@object-ui/core` and are re-exported from `@object-ui/fields`, so that
package's published surface is unchanged apart from the newly ruled gate.
`@object-ui/components` is a consumer of the gate and `@object-ui/fields`
depends on it, so a single shared table could not live in `fields` — and a
second copy would have meant a second dedupe set and two console lines for one
spelling. No package gained a new dependency.

A retired spelling never loses a stored value: `retypeFilterValue` is
deliberately not gated, and the refused filter row stays operable rather than
drawing a blank operator trigger.
