---
'@object-ui/data-objectstack': patch
---

Renaming a freshly-created view now persists — `updateView` reads and writes the same row, instead of reading the published overlay and losing the edit into a rejected partial write

ADR-0034 stages every runtime-created view as a per-item **draft**: a view made from the `+` tab lives only in the draft row until an explicit Publish, and the UI reads it back through `?preview=draft`. `updateView` addressed neither half of that. Its read went to the published overlay (`client.meta.getItem`, no draft qualifier), which 404s for a draft-only view; a `catch {}` labelled "treat missing as create-equivalent" then substituted `current = {}`, so the read-merge-write cycle merged onto nothing. What went out was the fragment that merge produces — literally `{label, name, object}`, no `viewKind`, no `config` — which the server rejects as an invalid ViewItem (422). Nothing surfaced to the user, and the draft row still held the old label, so the rename simply did not happen. Create, pin and delete were unaffected: they never take this path.

The read now probes the draft row first and, on a hit, merges onto that body and writes it straight back with `mode: 'draft'`. Whichever row the read resolved is the row the write updates, so the two halves agree by construction rather than by coincidence. Probing the draft **before** the published overlay is what makes it correct for a view that has both: writing the published row while a draft is pending would put the edit somewhere the draft shadows, and Publish would later overwrite it with the pre-edit body — losing the change a second time, further from the cause. A draft edit stays a draft, preserving ADR-0037's guarantee that nothing the preview shows goes live until Publish. Renaming a published view with no draft pending is unchanged, published read to published write.

The silent catch is gone. A view that resolves in neither home now throws naming the view and the object (creating one is `createView`'s job — no caller of `updateView` relied on the create-equivalent behaviour), and a network, permission or server fault on either read propagates instead of degrading into the partial write that corrupted the row. This turns a class of failure that was previously invisible into an error the existing call sites already catch and surface.

Set-default and reorder drive the same read-merge-write cycle with `{isDefault}` / `{sortOrder}` patches, so they were emitting the same partial write and are fixed by the same change.
