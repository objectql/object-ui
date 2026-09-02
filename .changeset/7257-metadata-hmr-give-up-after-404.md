---
'@object-ui/console': patch
---

`MetadataHmrReloader` stops flooding a production-posture deployment with
`GET /api/v1/dev/metadata-events` 404s (objectui#7257).

The dev-only HMR component subscribes via `EventSource`, gated on
`import.meta.env.DEV`. That gate is not airtight against every rig: a
"prod-like" build/serve setup that forces `NODE_ENV=development` for the
*build tooling* while running the server itself in production posture can
bake `DEV === true` into the shipped bundle even though the server never
mounts the dev route there — and the old reconnect loop treated every closed
connection as transient, retrying on a fixed `reconnectDelayMs` (2s)
forever. On an env host that is ~30 requests/minute of 404s per open
record/list page, drowning out the legitimate `sys_inbox_message` /
`sys_notification_receipt` polling in the same console.

The first `connect()` attempt now doubles as the real capability probe: if
the stream closes before it ever reaches `open`, the component gives up for
good instead of retrying (and specifically not a longer interval either —
that would still spam 404s, just slower). A stream that DID open at least
once and later drops — a real dev-server restart or network blip — keeps
reconnecting exactly as before.

No production-side replacement is introduced here: this component's only
job is turning "a metadata file changed on disk" into a full reload, and
production deployments have no such file-system event to watch. The
separate Studio-left-nav-doesn't-refresh caching issue does not go through
this SSE stream and needs its own fix.
