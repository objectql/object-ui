---
"@object-ui/auth": patch
"@object-ui/console": patch
---

fix(auth): gate the device-approval page on `features.deviceAuthorization` (framework#2874 / #2513)

`DeviceAuthPage` hit the RFC 8628 `/device*` endpoints unconditionally, even
though the better-auth `deviceAuthorization` plugin is opt-in (off by default) —
so on a deployment without it the page rendered an approve form that only failed
on submit. It now reads `features.deviceAuthorization` from the public auth
config and shows a plain "not enabled" notice when the capability is off,
matching the "form follows plugin" honesty guard the framework side introduced
in #2874. `AuthPublicConfig.features` gains the `deviceAuthorization` flag
(previously absent from the client type). A config-fetch error fails open so a
transient blip never hides a legitimately-enabled page.
