---
'@object-ui/app-shell': patch
'@object-ui/i18n': patch
---

A write-warning toast now words each strip reason on its own instead of calling everything that is not `readonly_when` "read-only".

`emitWriteWarning` picked its sentence with a two-way conditional on
`reason === 'readonly_when'`. The other arm was never "readonly" — it was
"everything that is not `readonly_when`", so any reason the server-side write
path gained afterwards was announced to the user as a read-only lock, pointing
them at a permission problem that does not exist. That is the same defect
objectui#3484 / framework#3794 fixed for `readonly_when` itself, one reason
later.

The reason is now resolved through a table declared
`Record<DroppedFieldsEvent['reason'], …>`, mirroring the framework side of the
same seam (`service-automation`'s `DROPPED_REASON_LABEL`) and the shape the
spec's own `DroppedFieldsEventSchema` comment asks consumers for. The next reason
added upstream is a `type-check` failure here, unworded, where the conditional
compiled forever — which is what re-exporting THE spec type rather than a
hand-widened `string` was for all along.

Not a latent fix: the pinned spec (`@objectstack/spec` 17.0.0-rc.6) already
carries `primary_key` (objectstack#6437), the strip that keeps a payload `id` the
update dispatch ruled is not an identifier out of the targeted rows' primary key.
Until now a user who triggered it was told the field was read-only. It gets its
own wording in all ten locale packs: "The record's identifier cannot be changed
by a save, so it did not take effect".

One more line was added for a reason ahead of this bundle's pin — the adapter
reads `reason` structurally off the wire without checking it against the enum, so
a server newer than the bundle can deliver a value no table can have an arm for.
It names the fields and claims nothing about the cause, rather than throwing
inside a listener invoked as `void emitWriteWarning(...)` (which would cost the
user the whole toast, including the reasons that did resolve) or reusing a
wording that would state a cause we do not know.
