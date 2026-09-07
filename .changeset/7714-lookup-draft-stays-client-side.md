---
'@object-ui/app-shell': minor
'@object-ui/plugin-designer': minor
---

A half-filled relationship field stays in the client and is never PUT (objectui#7714,
maintainer ruling on objectui#7122 item 4, 2026-09-05).

**Breaking, deliberately, and stated rather than implied.** Both metadata writers —
`MetadataService.saveFields` / `saveObject` in `@object-ui/app-shell`, and
`MetadataFieldsPage` in `@object-ui/plugin-designer` — now REFUSE a `lookup` or
`master_detail` field whose `reference` is missing, empty, blank or not a string. A
caller that previously got a PUT now gets a thrown error and **no request at all**. The
refusal is raised while the wire `fields` map is being built, so nothing is sent and
nothing is partially applied.

**Why the draft may not leave the client.** `@objectstack/spec` 17.3.0 turned
`reference` from prose into a hard requirement on relationship types (a `custom`
refinement at path `reference`). Driven against a real 17.3.0 backend in a running
designer: creating a `lookup` and leaving its target empty PUT the whole object,
came back `422 INVALID_METADATA` at `fields.<name>.reference` — and then the NEXT
edit, to a different and already-saved field, was refused identically, because the
half-filled draft rides along inside the same document. The author sees that later
edit rendered as applied while the server has none of it, and the only escape that
does not require noticing the lookup is a reload, which discards the work. An editing
session's half-finished state belongs to the client, not to the metadata store.

⛔ **Not** "strip the incomplete field from the body and report a successful save".
That shows the author a field the server never received — the silent-drop shape
objectstack#4001 closed.

⚠️ **A declared divergence: objectui is stricter than the contract here.** The
predicate is `typeof reference === 'string' && reference.trim() !== ''`. Measured on
the 17.3.0 artifact, at field level and again through `ObjectSchema`, the spec
ACCEPTS a whitespace-only `reference` while refusing an absent or empty one — so
`reference: '   '` is refused by these writers on their own authority, not the
platform's. Kept deliberately: whitespace names no object (the spec's own
`ObjectSchema.fields` key grammar `/^[a-z_][a-z0-9_]*$/` admits no whitespace-bearing
name), so admitting it only moves the identical failure past the PUT and into a stored
document, where it surfaces with no field named. Filed upstream as objectstack#16126;
if the spec trims, behaviour here is unchanged and only the declaration retires.

The refusal message diagnoses which of the four states it found — absent, empty,
non-string (`invalid_type`, a value of the wrong kind rather than a missing target),
or blank — because the repair and the consequence differ per state.

`minor` rather than `major` per `AGENTS.md`: objectui's major tracks `@objectstack`'s,
so objectui's own breaking changes ship as `minor` with the breaking semantics stated.
