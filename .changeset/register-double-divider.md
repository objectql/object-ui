---
'@object-ui/auth': patch
---

RegisterForm: drop the duplicate "or" divider (matching the LoginForm fix in
#2629). SocialSignInButtons already renders its own "or continue with email"
divider under the provider buttons; RegisterForm stacked a second "OR" line on
top, which read as a rendering glitch on the sign-up page.
