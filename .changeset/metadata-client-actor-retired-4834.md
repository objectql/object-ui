---
'@object-ui/data-objectstack': minor
---

**Breaking (published surface):** remove `options.actor` from `MetadataClient`'s
`save`, `reset`, `publish` and `rollback`, and stop emitting the `X-Actor`
request header.

The server stopped honouring that header. objectstack#7941 ruled that the
recorded actor is the identity the request was authorized as, and removed the
header limb from the `/meta` write resolver — attribution cannot drift from
authorization. The option therefore typed cleanly, sent a header, and could not
influence the audit or history row it appeared to address: a false affordance
that promised attribution and silently failed to deliver it.

Three declarations go: `MetadataClientSaveOptions.actor` (inherited by
`MetadataDeleteOptions` via `extends`, so it served both `save` and `reset`),
and the inline `{ actor?: string }` on each of `publish` and `rollback`.
`MetadataAuditEntry.actor` is unaffected — that is the server's read-back of
who acted, and it remains the way to see attribution.

Marked `minor` rather than `major` per this repo's version-alignment policy
(the fixed group's major tracks `@objectstack`, and `major` in a changeset
would drag all 39 packages off that cadence).

No caller in this repo passed `actor`; the census found the only in-repo
occurrence was the client's own unit test. Callers outside this repo that still
pass it are unaffected at runtime beyond losing a header the server already
ignored — the property is dropped rather than forwarded, pinned by
`metadata-actor-retired-4834.pin.test.ts`.
