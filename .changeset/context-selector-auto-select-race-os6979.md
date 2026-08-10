---
"@object-ui/app-shell": patch
---

Context selectors: picking an option the instant the dropdown fills no longer snaps back to the first one

A context selector is a *mandatory* scope, so `SelectorControl` auto-selects
`options[0]` as soon as the option list resolves and nothing concrete is
selected yet. That repair ran in a passive effect — a task AFTER the commit that
rendered the option rows — which left a gap in which the dropdown was already
rendered and clickable while no selection had been made. A pick delivered inside
that gap was applied and then immediately undone: the queued auto-select fired
second, carrying a closure from before the pick (`hasConcrete` still `false`,
and the search string it wrote from still the pre-pick one), so the user's
choice was replaced by the first row — silently, and for a `persist: 'query'`
selector with a URL rewrite behind it.

The gap is widest exactly where it matters: a slow options endpoint, a loaded
machine, or a low-end device, i.e. the cases where a user is most likely to be
already reaching for the option they want. The repair is now a layout effect, so
it lands in the same synchronous flush as the options it reacts to — no event
can be delivered in between, and the control is never painted with an empty
value while options exist.

Nothing else about the behaviour moves: same trigger, same deps, same one write
per medium. A scope that a later param-less nav link drops is still
re-established from the first option (the re-selection objectstack#5994 relied
on when it deleted the storage-to-URL bridge), which is pinned alongside the two
medium cases in `ContextSelectors.autoSelectRace.test.tsx`.

Found as a CI flake in `ContextSelectors.persist.test.tsx`
(objectstack#6979): under load the test's own pick lost the same race, twice,
with `expected 'billing' to be 'crm_core'`. Those cases now settle the
auto-select before picking, which also pins a fact none of them pinned before —
a user's pick overrides the auto-selected first option.
