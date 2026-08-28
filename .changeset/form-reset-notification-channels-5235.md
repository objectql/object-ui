---
'@object-ui/components': patch
---

The form renderer now keeps a `defaultValues` reset off `onChange` and off the
`form_change` `onAction` for **every** caller — including one that memoizes the
callback (objectui#5235).

"A record landing is not a user edit" was already this file's documented,
pinned behaviour, but two of the three channels delivered it by accident of
React's effect ordering: every layout DESTROY runs before any layout CREATE, so
a caller passing a fresh callback each render had its value subscription torn
down before the reset and re-established after. The guarantee was therefore
delivered by the callback's *identity changing*. Wrap the same callback in
`React.useCallback` — taught everywhere as a semantically neutral performance
optimization — and the identity stays put, the effect never re-runs, the
subscription survives the reset, and the whole loaded record comes back to the
host as if the user had typed it: the false "the user edited this" signal
objectui#2968 was filed about, in a form no type, doc or call site warned about.

The reset now states what those two channels report, the way `onDirtyChange`
already did (it computes its payload against the freshly installed baseline and
calls the host outright). Callers passing inline arrows see byte-identical
behaviour; callers who memoize stop receiving a phantom edit.

Not a contract change: whether a value channel *should* report a programmatic
reset stays open in objectui#5235. This only removes the answer's dependence on
caller identity.
