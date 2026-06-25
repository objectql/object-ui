---
'@object-ui/auth': patch
---

fix(auth): only render the "Sign in with SSO" button when the server reports it

`LoginForm` rendered the SSO button unconditionally, so a deployment without
enterprise SSO wired (the default for self-hosted / `os dev` local runs) showed
a button whose `POST /sign-in/sso` route isn't mounted — clicking it surfaced
the misleading "No SSO provider is configured for this email domain." only at
click time.

The button is now gated on `features.sso` from `GET /auth/config`, mirroring how
`SocialSignInButtons` already gates social providers. It defaults to hidden, so a
failed config fetch or an older server that doesn't report the flag simply omits
the button rather than offering a dead end. Requires the matching
`@objectstack/plugin-auth` change that surfaces `features.sso`.
