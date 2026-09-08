---
'@object-ui/app-shell': patch
---

Make `InspectorSelectField`'s `placeholder` reach the rendered trigger
(objectui#8450). Every empty select in the metadata-admin designer drew a BLANK
trigger instead of its hint.

The field bridges a caller's `''` through an internal sentinel so a "— None —"
option can exist at all (Radix `<Select.Item value="">` throws). That bridge also
guaranteed the value handed to Radix was never `''` or `undefined` — the only two
values for which Radix renders `SelectValue`'s placeholder — and a controlled
value matching no `SelectItem` renders as nothing. So the declared `'—'` default
was unreachable at all 45 call sites, none of which passes a placeholder of its
own.

The trigger now renders the placeholder itself, on the narrow state that means
"nothing is selected": no value AND no option standing for none. Where the caller
DOES offer a `''` row, that row is a selection and its label still wins,
unchanged. A non-empty value matching no option also still renders blank —
that is a stale value, not an empty one, and is out of this change's scope.

Measured effect on the designer: 13 of the 45 call sites can be empty without
offering a "none" row, and those now show `'—'` where they showed nothing — the
flow-node config selects, the app-nav item type, the curated page-block props,
the report dataset/chart-axis pickers and the action target/variant/mode/component
pickers. The other 32 render exactly as before.
