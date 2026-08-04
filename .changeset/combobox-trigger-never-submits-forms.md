---
"@object-ui/components": patch
---

The Combobox trigger now declares `type="button"` explicitly, so it can never
submit an enclosing `<form>` (objectui#3344). The current Radix
`PopoverTrigger` happens to supply `type="button"` through its Slot, but that
form-safety guarantee was an upstream implementation detail — it is now a
locally declared, regression-tested contract, matching the explicit style of
LookupField / MultiSelectField / RatingField. The default sits before the
trigger pass-through spread (objectui#3318), so a consumer who explicitly
passes `type` (e.g. `type="submit"`) still wins.
