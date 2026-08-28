---
'@object-ui/app-shell': minor
---

`MetadataService`'s two delete methods no longer PUT a hand-written tombstone. They call
the metadata API's own delete door instead, and the latent `enabled?: boolean` on
`ObjectMetadataPayload` is gone with it (objectui#6238). Object-level member of the
objectui#5761 family, surfaced by the `ObjectSchema` oracle objectui#6223 added to
`scripts/check-designer-field-key-parity.mjs`.

**What the tombstone actually did.** `deleteObject` and `deleteMetadataItem` wrote
`{ name, enabled: false, _deleted: true }` through `client.meta.saveItem`, i.e.
`PUT /api/v1/meta/:type/:name`. Measured against the installed `@objectstack/spec` 17.2.0
using `getMetadataTypeSchema` — the registry the framework's own `saveMetaItem` resolves a
PUT's validator from — across all 26 registered overlay schemas:

```
ObjectSchema.safeParse({ name, label, fields })                        => success = true   (control)
ObjectSchema.safeParse({ name, label, fields, isSystem: true })        => success = true   (control)
ObjectSchema.safeParse({ name, enabled: false, _deleted: true })       => unrecognized_keys ["enabled","_deleted"]

25 of 26 registered overlay schemas refuse `enabled` and/or `_deleted` BY NAME
 1 of 26 (`view`) tolerates them; 4 kinds have no registered schema at all
 0 of 26 strip them
```

So there were two failure modes, not one. Where the type has a strict schema — `object`
among them — the delete was a hard `422 INVALID_METADATA`, so nothing was ever recorded.
Where the schema is tolerant or absent, the framework stores the request item **verbatim**
(it deliberately persists the body rather than `parsed.data`), and `_deleted` has no reader
anywhere on the platform — so the "soft delete" was a silent no-op that left the item live
carrying two junk keys. Neither outcome deleted or disabled anything.

**The resolution is a mechanism change, not a rename**, and there was nothing to rename to.
`ObjectSchema`'s 42-key accept set has no on/off flag; the near-spelling `enable` is
`ObjectCapabilities`, a system-features *module object*, so `enabled: false` → `enable:
false` fails on the value where it passes on the name. No wire key was invented: a metadata
soft-delete convention would be a `@objectstack/spec` contract addition, and the platform
does not have one.

**Both sites now call `client.meta.deleteItem(type, name)`** — `DELETE
/api/v1/meta/:type/:name`, the same request `MetadataClient.reset` issues, which is the
mechanism `MetadataObjectsPage.handleObjectsChange` and `ResourceEditPage` already used for
deletes. Two mechanisms for one operation had disagreed; now there is one. The delete route
is generic over `:type` on the same route family and capability gate as the PUT, so this
holds for every category the generic `deleteMetadataItem` serves, not just `object`. The
doc comment claiming the API "exposes `saveItem` but no dedicated `deleteItem`" was stale:
`@objectstack/client` 17.2.0 declares `meta.deleteItem` on the very client this service
already holds.

`reset` semantics are the overlay's, and that is the governed answer rather than a
shortfall: it removes the customization row — which *is* deletion for an object the
designer authored — and restores the artifact for one a package declares, an object you are
not allowed to delete. Which of the two an item is, is what the API's own `deletable` /
`resettable` verdicts report, not something a client-side flag should decide.

**No published type changed.** `ObjectMetadataPayload` is exported from its module but that
module is not re-exported by `packages/app-shell/src/index.ts`, the package's only entry, so
the removed `enabled?: boolean` was never on the published surface and no `**/src/index.ts`
is touched. What consumers *can* observe is behaviour: `MetadataService` is reachable
through the published `useMetadataService()` hook, both method signatures are unchanged
(`Promise<void>`), and the HTTP request they issue changes from a `PUT` with a body to a
`DELETE`.

The `KNOWN_UNPARSEABLE_KEYS` entry in `scripts/check-designer-field-key-parity.mjs` goes
with the fix — that ledger ratchets in both directions, so an entry left behind for a
resolved key is as red as a missing one. It is now empty for the first time, which is the
ratchet arriving where it was pointed; the self-test's non-vacuity guard moved onto a
fixture accordingly, so an empty ledger reads as success rather than as a demand that some
key stay unresolved.
