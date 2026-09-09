---
---

Dev-only. The metadata-designer preview gallery's `object` sample spelled its
`status.options` as three bare strings, a shape `FieldSchema` refuses; they are
now `{ label, value }` option objects, with the ledger reason in
`preview-samples-spec-valid.test.ts` updated to match and new pins closing the
two masks that hid the defect.

Nothing published changes: `preview-samples.ts` is reachable only from
`preview-gallery.html`, which is not an input of the console's production build,
and every other file in this change is a test.
