---
"@object-ui/console": patch
---

DeviceAuthPage claims the device code (GET /device?user_code=…) before approve/deny — better-auth's device-authorization plugin rejects both with 400 "not been claimed by a verifying session" otherwise, so approval silently failed.
