---
'@object-ui/app-shell': patch
---

PackageFormDialog: a producer-marked `error.userMessage` now outranks the localized copy on the 409 and 403 arms

Creating or saving a package refused with **409** (id taken) or **403** (no `manage_metadata` capability) answered with a localized constant and discarded the envelope's prose — including a `userMessage` the producer had marked, at throw time, as addressed to the person reading the screen (ADR-0112 / objectui#3821). Those are the two refusals an author meets most on this surface, so the one channel written for them was dropped exactly where it mattered.

Both arms now render a marked sentence when the envelope carries one, and keep the localized constant as the fallback for an **unmarked** body — which is every refusal the package doors emit today, so the settled localized posture for a withheld capability (objectstack#8270) is unchanged. This also removes a divergence that depended on the transport: the same marked body used to read one way when an HTTP status survived the wire and another way when it did not.
