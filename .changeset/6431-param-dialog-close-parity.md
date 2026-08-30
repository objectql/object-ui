---
'@object-ui/app-shell': patch
---

`app-shell`'s two action runtimes now reset `ActionParamDialog` the same way when it closes
(objectui#6431). `useConsoleActionRuntime` closed with `setParamState({ open: false, params: [] })` —
replacing the whole state object, emptying `params` and dropping `title`, `description` and
`resolve` — while `RecordDetailView`, which mounts a second runtime into the same dialog,
closed with `setParamState(s => ({ ...s, open: false }))`. The console runtime moves onto the
field-preserving shape.

The user-visible effect is in the fade-out. `DialogContent` carries
`duration-200 data-[state=closed]:animate-out`, so Radix keeps the content mounted through
its exit animation and the dialog goes on rendering off `state` for the whole ~200ms. Under
the blanking shape a params form the user had just filled in re-titled itself from the
action's own label to the generic "Action parameters", swapped the action's description for
the generic one, and dropped every param row — an empty, generically-labelled box fading out
where a form had been. The confirm pair converged on the same shape for the same reason in
objectui#6034; this is that ruling re-measured on this dialog rather than inherited, because
`ParamDialogState` carries a form rather than display text and "blank it on close" could have
been deliberate here.

It was not, and nothing else changes for the user. The values a user types are not in
`paramState` at all — they live in `ActionParamDialog`'s own `values` state, which its
`useEffect` reseeds from the param defaults on every `state.open` false→true edge, so a
reopened dialog starts blank under either reset shape. The retained `resolve` is inert: the
dialog settles the promise before it asks for the close, and the open path replaces the whole
state object.
