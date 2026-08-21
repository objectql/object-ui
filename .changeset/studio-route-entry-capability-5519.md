---
'@object-ui/console': patch
---

The Console now gates the `/studio/*` routes on the `studio.access` ENTRY
capability, not just on the backend's refusal of the writes behind them
(objectui#5519).

`/_console/studio/` rendered the full Studio pillar builder — Data /
Automations / Interfaces / Access, with Publish and Save draft — to any
authenticated principal who typed the URL, on deployments where the Studio nav
tile is deliberately absent and every metadata write is refused. A plain tenant
user was walked through the entire "new package" form and only refused at
submit (403). The lockdown criterion for that deployment shape is two-part — UI
entry hidden AND API refused — and only the API half was met; what stood on
this side was a write-level gate where an entry-level one belongs.

The whole `/studio` subtree now hangs off one route element that reads
`systemPermissions[]` from `GET /api/v1/auth/me/permissions` (the endpoint this
app already consumes) and admits only a principal whose LOADED set carries
`studio.access` — the capability declared as "Enter the Studio metadata-design
surfaces", which a tenant org owner does not hold by design. Everyone else is
sent to `/home` without the builder ever mounting.

The fail direction is deliberately inverted from this app's other capability
gates: those fail OPEN on an unknown answer because their bad outcome is a
holder losing a button, whereas a route gate's bad outcome is a non-holder
seeing the builder. So the loading window renders the console splash (never the
builder), an outright fetch failure renders the retryable error splash, and a
`200` that carries no `systemPermissions` at all is refused rather than waved
through. The server-side refusals are untouched.
