---
'@object-ui/data-objectstack': minor
'@object-ui/app-shell': minor
---

The metadata designer states its package on the publish step, not only on the save (#5420)

Studio's designer save→publish loop bound the draft to a software package on the
save (`PUT ?mode=draft&package=<id>`) and then sealed it with a publish that named
no package at all. `objectstack#10354` (shipped in `@objectstack/rest` 17.2.0) taught
`POST /meta/:type/:name/publish` to accept `?package=<id>`, so the second call can now
state the same binding the first one already states.

- `MetadataClient.publish()` accepts `packageId` and sends `?package=<id>`, the same
  wire spelling and the same `encodeURIComponent` treatment `save()` gives it.
- `MetadataResourceEditPage` reads the binding for BOTH steps from one derivation
  (`readActivePackageBinding`), so the two calls of one loop cannot drift apart. The
  `?package=all` "show everything" scope keeps folding to "no package".

The parameter is **omitted**, never sent empty, when the designer holds no binding.
Empty and absent are the same to the framework's normaliser today, but absent is the
shape the save door already followed, and the framework's promotion path branches on
the key being present downstream.

What this buys is **reachability**, not speed: it lets `#9612`'s package-closure
narrowing at the runtime publish gate fire on an HTTP-driven promotion at all. That
narrowing has a second, independent gate this does not touch — objects carrying no
`_packageId` provenance are kept unconditionally — so on a tenant-authored overlay
corpus stating the package still narrows nothing.
