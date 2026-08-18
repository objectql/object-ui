---
'@object-ui/app-shell': patch
---

A failed field fetch in the metadata-admin `field-selector` picker now reads as a failure, not as "this object has no fields".

`FieldSelectorWidget` was the fourth loader of the family objectui#5170 and
objectui#5169 closed, and the only one that does not go through
`MetadataClient`: a raw `fetch` to `/api/v1/objects/:name/fields`, its own
component-local `fields` / `loading` state, no `WidgetContext`. That is why the
`catalogErrors` channel added for the other pickers never reached it, and why it
kept the defect after they were fixed.

It could reach a false empty two ways, and both are closed here:

- the `catch` wrote `setFields([])` — the exact value a successful response with
  no fields writes — and cleared the loading flag, so a dropped connection or an
  expired session rendered as a completed, empty picker with a `console.error`
  nobody reads;
- it never checked `res.ok`, so a 4xx/5xx whose body happens to parse as JSON
  landed in the SUCCESS branch with `data.fields` undefined and `|| []` spelled
  the refusal as an empty catalog. This mouth is the worse of the two: no error
  was raised for the `catch` to swallow, so a union guarding only the `catch`
  would have left it wide open.

Both now leave through one door — a throw — and the loader is the four-arm
`LoadState` (`idle | loading | loaded | error`) the sibling pickers already use.
A failure renders the shared `PickerLoadFailure` block with the server's own
message, and the picker is replaced rather than decorated, so nothing on screen
can still be read as a measurement of zero. Whatever field is already stored
stays visible and removable: a failed catalog must not also block authoring.

The "no fields" reading is deliberately kept for the case where it is true — a
load that COMPLETED and found nothing still renders the disabled picker,
unchanged and now reachable only from the `loaded` arm. No copy was added or
reworded.

`usePickerLoad`, the shared loader hook, moves from `ResourceEditPage` into
`loadState` so this fourth loader reuses it instead of hand-rolling a fifth
union in a second file — which is exactly how this loader came to be missed.
Behaviour of the three existing callers is unchanged.
