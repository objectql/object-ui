---
"@object-ui/console": patch
"@object-ui/app-shell": patch
---

Two bind-flow auth fixes from the runtime-identity-binding E2E: (1) DeviceAuthPage claims the device code (GET /device?user_code=…) before approve/deny — better-auth rejects both with 400 "not been claimed by a verifying session" otherwise, so approval silently failed; (2) CloudConnectionPanel sends the TokenStorage Bearer on its same-origin /cloud-connection/* calls (same pattern as marketplaceApi) — cookie-only fetches read as signed-out whenever the runtime cookie is stale.
