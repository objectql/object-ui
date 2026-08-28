---
'@object-ui/app-shell': patch
---

Studio's "duplicate base" now reports a partial or empty duplicate as a failure instead of
a complete success (objectui#6593).

`duplicatePackage()` read `success` at the **top level** of the response body. That is the
runtime dispatcher's envelope — `deps.success(result)` answers
`{ success: true, data }` — so on every HTTP 200 the flag it read was `true` by
construction. The operation's own verdict lives one level down in `data` and is a real
three-state: the server computes it as `failed.length === 0 && copied.length > 0`.

Two outcomes therefore answered 200 with `envelope.success: true` while the duplicate had
not succeeded, and both were shown to the author as "created", followed by a navigation
into the new base:

- **partial** — some items failed to copy. `failed[]` carries a per-item `error` string
  that is the only place the reason is ever stated, and none of it was read.
- **empty** — nothing was copied at all, e.g. an all-env-wide source package under a
  session that resolves no active organization (`copiedCount: 0`, `failedCount: 0`).

`duplicatePackage()` now unwraps `data` before reading the operation flag, and rejects with
a message built from what actually happened: the copied/failed counts, plus each
`failed[].error` (the first five by name, then a `+N more` tail). A generic `HTTP nnn`
message is deliberately not sufficient for the partial arm — it is the half an author needs
to act on. The non-2xx arm is unchanged and still surfaces the error envelope's message.

The unwrap-then-read order is the one `revertCommit` already uses for the sibling
commit-revert route in `preview/commitHistory.ts`; this is one consumer converging on that,
not a new convention. The route's underlying contract absence (it publishes no response
schema, so reading the wrong `success` typechecks perfectly) stays upstream in
objectstack#12038.
