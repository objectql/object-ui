---
'@object-ui/auth': patch
---

Document the `X-Tenant-ID` edge contract that `createAuthenticatedFetch` stamps, and the
unstamped-first-request window in which it is not sent (objectui#5279). Documentation
only — no behaviour changes.

The header had no written contract anywhere, and the shape of the missing information was
actively misleading: its only non-CORS consumer lives in the **cloud** repository, so a
search confined to this repo and the framework (`objectstack`) returns zero readers and
reads as "nothing consumes this stamp". #5279 was filed on exactly that reading, and was
held until a cloud-side reading came back non-empty. Without the contract written down,
the next person to grep reaches the same false conclusion and deletes a live routing
input.

`packages/auth/README.md` gains "The `X-Tenant-ID` edge contract": what the header means
(a routing hint carrying the better-auth `activeOrganizationId` — not an identity claim,
not an authorization input, not what scopes rows), who stamps it and under exactly which
condition, who reads it, and what a reader may and may not assume. The framework half is
stated as a negative with its pin — `resolveAuthzContext` takes `tenantId` from the
API-key principal or `session.activeOrganizationId` and from no header — alongside
`plugin-sharing`'s record that trusting `x-tenant-id` as identity *was* a vulnerability.
The configuration half is quoted from the contract this package can actually resolve,
`TenantRoutingConfigSchema` in `@objectstack/spec/cloud`, where `X-Tenant-ID` is the
default of a configurable `tenantHeaderName` and `header` ranks second of six
identification sources behind `subdomain`.

The unstamped-first-request gap gets its own section: `ActiveOrganizationStorage` is
filled only after `AuthProvider`'s async `getSession` -> `listOrganizations` ->
`getActiveOrganization` chain resolves, so early-boot requests carry no tenant header at
all. What a reader observes is documented as **absent, never present-and-empty**, with the
five situations that open the window and the instruction to fall through to the next
identification source rather than fail closed. The gap is recorded, deliberately not
closed: the cloud readers observe today's behaviour, so changing when the header first
appears is its own decision.

Three cases in `createAuthenticatedFetch.test.tsx` pin the statements the prose makes
about the wire — no active organization means no header at all, the stamp is not gated on
`/api/` the way `Authorization` is, and the active organization overwrites a caller-set
`X-Tenant-ID` — so the documentation cannot drift away from the behaviour unnoticed.
