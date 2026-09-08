---
"@object-ui/console": patch
---

Approvals inbox: a record that was deleted now renders a "record deleted"
tombstone instead of degrading to the bare record id (objectui#7108).

When an approval's underlying record is deleted, the platform voids the
still-pending requests and stamps the cause on the row (`status: 'cancelled'`
plus `cancel_reason: 'record_deleted'`, objectstack#13568). The console did not
read that cause: the row fell back to `formatIdentity(record_id)` and showed an
opaque id where the business identifier used to be, still offering a link into a
page that no longer exists. The desktop row, the mobile card and the request
drawer now all render the tombstone, drop the link, and keep the snapshot's
business identifier on the meta line so the audit row still says which record
the approval was about. The `cancelled` status badge gained a label too — it was
rendering the raw wire token.

The copy is the platform's own: the localized `cancel_reason` option label when
the server's translation bundle has loaded, falling back to the authored English
in `@objectstack/spec`. No second string is authored here.

Terminal (`approved` / `rejected`) rows are deliberately unchanged. They were
never cancelled, so they carry no cause, and the read path fuses "deleted" with
"hidden from this viewer" on purpose (existence non-disclosure) — so nothing on
the wire tells them apart. Rendering a tombstone from a failed lookup would
report a deletion to someone whose only problem is permissions
(objectstack#7345), which is a worse claim than the id it replaces.
