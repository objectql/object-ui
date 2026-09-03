---
---

Comment-only correction in `app-shell`'s `DashboardView` header block — no type,
schema, export or runtime path is touched, so nothing releases.

The block over the header's title fallback claimed "Per @objectstack/spec,
`DashboardSchema.title` is 'the dashboard title displayed in the header'".
Measured on the installed `@objectstack/spec@17.2.0`, `DashboardSchema` refuses
`title` **by name** — `unrecognized_keys(title)` at the document root, against a
spec-legal control (`{ name, label, widgets }`) that parses — and its 20 keys
spell the display name `label`, not `title`. `header` declares `showTitle` /
`showDescription` / `actions` only, so it toggles a title and never carries one;
`{ header: { title } }` is refused too (`unrecognized_keys(title)@header`).

The old wording made `title` read as authorable dashboard metadata, which is the
expensive way to learn it is not: the save route refuses the whole body with
`422 INVALID_METADATA` / `unrecognized_keys` before persistence, so an author
who follows the comment gets no header and a rejected document. The replacement
says what `title` actually is — the legacy objectui spelling, the same
legacy-then-canonical pair `DashboardRenderer` reads — and states the 422, which
is the fact the next reader needs.

It also corrects a second reading the old block invited: `previewSchema` is not
a host-supplied preview channel. `DashboardView` takes no such prop; the value
is the view's own widget-pruned copy of `dashboard`, so both arms of `headerSrc`
read the same stored document.
