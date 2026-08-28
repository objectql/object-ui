---
'@object-ui/app-shell': patch
---

`MetadataService.saveFields` no longer PUTs the framework's own read decorations back (objectui#6480).

`saveFields` fetches the current object and spreads it verbatim (`...existingObject`) so that every key the service does not model survives a field save. That spread does not distinguish keys the **author** owns from keys the **framework** adds on the way out: `@objectstack/spec` declares `_diagnostics` and `_draft` as `METADATA_READ_DECORATIONS` — stamped onto served metadata documents by the read path — and `ObjectSchema` refuses both **by name**. A served document carrying either one was therefore spread straight back into the body of `PUT /api/v1/meta/object/:name`.

The body now passes through the spec's own exported `stripReadDecorations` before it is sent, so the list of decorations stays the spec's rather than a local copy that goes stale the next time the framework adds one. This is the strip-on-write shape `MetadataObjectsPage.handleObjectsChange` already uses for `group`, applied where the spread is — simply not writing the key is not enough when the spread is verbatim.

The strip is deliberately bounded to those two keys and is not a general "remove whatever the schema refuses" pass: an off-spec key the author owns still goes out and is still refused loudly, where someone can see it. Nothing is lost by dropping the decorations even though a PUT is an upsert — `_diagnostics` is the read-path validation verdict, recomputed on every read, and `_draft` reflects the row's `state` column and the `mode` parameter, never the body. The ADR-0010 protection envelope (`_lock`, `_provenance`, …) *is* write-path state the server merges back, and the spec deliberately keeps it out of the decoration list, so it is untouched.
