---
"@object-ui/console": patch
---

fix(settings): read the locked key from `error.details`, tolerating both wire shapes — objectstack#4224

`SettingsView.onSave` rendered the `SETTINGS_LOCKED` toast from
`err.payload.error.key`. That key was a SIBLING of `code`/`message` inside
`error`, a position `ApiErrorSchema` never declared — it reached the console only
because the schema is a plain `z.object` and silently strips what it does not
declare, so nothing ever failed to flag it. objectstack#4224 moves it into
`error.details`, the slot the contract does declare.

This is the console's half, and it ships **first**: the read is now
`error.details?.key ?? error.key`, so the toast keeps naming the locked key
against servers on either side of that change rather than degrading to
`Locked by environment: undefined` during the window where the two repos are on
different versions. The fallback can go once the oldest supported server carries
the fix.

Also stops interpolating a missing key: when neither position carries one the
toast now reads `Locked by environment` rather than appending `undefined`.

This was the only in-console reader of the four keys objectstack#4224 relocated
(`namespace`, `key`, `reason`, `fields`) — a repo-wide grep for the other three
finds no consumer.
