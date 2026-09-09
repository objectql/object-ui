---
'@object-ui/app-shell': patch
---

`InspectorSelectField` surfaces a stored value the option roster does not offer,
instead of painting a blank trigger (objectui#8488).

Radix renders a controlled value matching no `SelectItem` as nothing at all, so a
metadata key holding a stale or off-spec value drew an EMPTY select in the designer —
pixel-identical to "this field is unset". The author saw an empty control, picked a
value to fill it in, and silently overwrote a key they were never shown.

The field now synthesises a selectable, flagged row for a non-empty value the roster
does not contain, labelled `VALUE (not found)` by default. Every call site inherits it.

Deliberately NOT the placeholder: drawing `—` over an unknown value would assert
"nothing is stored" about a field that is storing something — confidently wrong rather
than merely blank. objectui#8450 keeps owning the empty state; the two stay
distinguishable on screen, which is pinned as its own case.

Eight call sites had hand-rolled the rule and are now deleted in favour of it. Three
had flagged their row — `ActionTargetField` (`(not found)`), the view-column field
picker (`(not in object)`) and `FlowNodeConfigField`'s select branch (`(deprecated)`,
framework#4278 / ADR-0090 D3). Five had made the value visible but UNFLAGGED —
`ReportDefaultInspector`'s type, dataset and both chart axes, and
`ViewVariantInspector`'s type — so a value the catalog had dropped read exactly like
one it offered. Those five now flag it. Wording stays with the call site through the
new optional `unknownValueLabel` prop, so `(deprecated)` still says the thing
`(not found)` does not.

Known boundary, unchanged by this: an async picker that has not loaded yet is
indistinguishable from an empty roster, so a valid value briefly wears the flag while
its options are in flight. That blind spot is inherited from the hand-rolled copies,
not introduced here, and is tracked separately.
