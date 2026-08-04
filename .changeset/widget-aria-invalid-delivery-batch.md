---
"@object-ui/fields": patch
"@object-ui/components": patch
---

20 more registered field widgets now announce a failed validation to assistive
tech: `multiselect`, `radio`, `checkboxes`, `tags`, `lookup`, `master_detail`,
`user`, `owner`, `file`, `image`, `location`, `object`, `color`, `rating`,
`code`, `avatar`, `address`, `geolocation`, `qrcode` and `object-ref` carry
`aria-invalid="true"` on their real focusable control after a validation
failure, where before the red message rendered while a screen reader was told
nothing (objectui#3318, the registry-wide gap objectui#3306's sweep measured).

Each widget follows the objectui#3222/#3306 pattern: the `toDomProps(props)`
whitelist spread goes onto the control the user actually focuses — the input,
the lookup trigger button, the radiogroup (`role="radiogroup"` is the
ARIA-designated carrier for a set of radios), every chip/checkbox/star of the
composite option widgets, the upload dropzone/button — followed by an explicit
`aria-invalid={!!error}` computed from the published `error` slot. Wrapper
`<div>`s never carry the state, and `name` is withheld from non-form-control
elements (the objectui#3291 leak class).

`Combobox` (`@object-ui/components`) now accepts standard button attributes
and forwards them to its focusable `role="combobox"` trigger, giving
combobox-based widgets an element to deliver `aria-invalid` /
`aria-describedby` to — the same seam objectui#3306 opened on
`SelectTrigger`.

Nine types remain on the objectui#3318 ratchet ledger with their blockers
documented there (`formula`/`summary`/`auto_number`/`vector` render no
focusable control; `grid`, `slider`, `signature` need component-level design;
`filter-condition`/`recipient-picker` deliver in their editable states but
render a dependency-gate hint with no control in a fresh form).
