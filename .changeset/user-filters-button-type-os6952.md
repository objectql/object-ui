---
"@object-ui/plugin-list": patch
---

`UserFilters` preset tab buttons no longer submit an enclosing form; all six buttons declare `type="button"`

An HTML `<button>` defaults to `type="submit"` inside a `<form>`, so a preset
filter tab (`filter-tab-*`, tabs mode) submitted the enclosing form on every
click. The three buttons objectstack#6952 named now declare `type="button"`
explicitly — the dropdown chip trigger (`filter-badge-*`), the overflow trigger
(`user-filters-more`) and the preset tab — joining the session-tab buttons that
objectstack#5236 already declared it on.

Only one of the three was actually at risk, and the difference is measured
rather than assumed. The chip and the overflow trigger are
`PopoverTrigger asChild` children, and Radix's `PopoverTrigger` renders
`Primitive.button type="button"`; its Slot merges that onto a child declaring no
`type` of its own, so both already rendered as `button`. Reverting the change
confirms it: those two keep reading `button`, the plain preset tab button reads
`null`. For the two triggers this therefore moves a contract out of an upstream
implementation detail and into local source — the same reasoning objectui#3344
wrote onto the Combobox trigger — while the preset tab is a real fix.

Dormant rather than live: the only mount point today is `ListView`'s toolbar,
which is not inside a form, so no shipped screen submitted anything. The new
tests pin every rendered `UserFilters` button, in both modes, so a future button
cannot land at the submit default and an upstream Radix change surfaces in this
package's tests instead of in a user's form.

The in-file comment claiming "a Radix trigger keeps the HTML default of `submit`"
is corrected in passing — it is the inaccuracy that propagated into
objectstack#6952's premise.
