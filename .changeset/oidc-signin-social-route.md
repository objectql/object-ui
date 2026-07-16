---
'@object-ui/auth': patch
---

`signInWithProvider` with `type: 'oidc'` now signs in through better-auth's
core social route (`POST /sign-in/social`) and only falls back to the legacy
`POST /sign-in/oauth2` endpoint when the social route rejects the provider.

better-auth ≥ 1.7 restructured the `genericOAuth` plugin: generic OAuth/OIDC
providers are injected into the core social sign-in flow and the dedicated
`/sign-in/oauth2` endpoint no longer exists. The old client therefore 404'd on
every "Continue with ObjectStack" click (platform SSO broken end-to-end on
current framework). The fallback keeps the button working against older
(< 1.7) servers during the coordinated rollout; when both routes fail, the
social-route error is surfaced since on a ≥ 1.7 server it is the real failure.
