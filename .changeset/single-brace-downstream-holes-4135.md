---
'@object-ui/i18n': patch
'@object-ui/auth': patch
'@object-ui/console': patch
---

`auth.forgotPassword.successDescription`'s address hole is now spelled with
single braces (`{email}`) instead of i18next's double braces (`{{email}}`),
in all ten locale packs.

This is a spelling-only change — rendered output is byte-identical in every
language, because the hole was never filled by i18next in the first place:
`ForgotPasswordForm` substitutes the address itself once the user submits
the form (the label renders before the address exists, so `t()` cannot do
it). `{{email}}` and a genuinely unfilled i18next hole were indistinguishable
at the call site, and passing `email` as an interpolation argument — the
natural "fix" for what looks like a missing argument — would let i18next
consume the hole and cause the address to be appended a second time
(objectui#4135).

Converging on `{x}` for every hole a component fills downstream of `t()`
(the convention `resendOtpCountdownText`'s `{seconds}` already used) puts
this hole outside i18next's `{{…}}` syntax entirely, so the ambiguity is
gone by construction rather than fenced by an exemption. Accordingly,
`scripts/check-i18n-call-site-keys.mjs`'s `EXTERNALLY_INTERPOLATED_HOLES`
registry entry for this key is retired — the gate needs no exemption for a
hole i18next was never going to touch.

`ForgotPasswordForm.tsx`'s replacement marker and its own built-in default
label move to the same spelling in the same change, as does the inline
`defaultValue` at `apps/console/src/pages/auth/ForgotPasswordPage.tsx`'s
call site.
