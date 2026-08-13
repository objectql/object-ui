---
'@object-ui/console': patch
---

Settings save: render the fail-closed crypto refusal as its own state instead of a generic save failure

A deployment with nothing able to encrypt a declared-secret setting refuses the write, and
since objectstack#8396 it says so in its own wire envelope — `SETTINGS_CRYPTO_UNAVAILABLE`,
with `error.details` locating the refused `{ namespace, key }` and `error.message` carrying
the operator prescription. The console read none of it: the code fell through to the generic
error path, where the field-error extractor finds no `details.fields` array and returns null,
so nothing was marked and the whole refusal collapsed into one transient toast reading "save
failed". The admin was told the save did not work; that the DEPLOYMENT cannot encrypt, and
which key it refused, was on the wire and thrown away.

`SettingsView` now branches on the code the way it already does for `SETTINGS_LOCKED`: it
names the refused key as `namespace.key` from the declared `error.details` slot, and renders
the server's prescription verbatim in a persistent panel — the server owns that copy, so the
console frames the refusal but never restates how to fix it. The draft is kept, so the value
is not lost while the deployment is reconfigured, and the refusal clears when its claim can
actually have become false: a new save attempt, a save that succeeds, a discard, or a reload.

The value itself is never rendered — the envelope locates the refusal and deliberately does
not carry the secret, and the console does not re-introduce it from the draft it is holding.
`SETTINGS_LOCKED` and `SETTINGS_VALIDATION` are untouched, and an unrecognized code still
takes the generic path.
