---
"@object-ui/i18n": patch
---

Backfill the auth family's 54 missing locale keys — `auth` 26 + `oauth` 16 + `acceptInvitation` 12 (objectui#3546, slice three)

`scripts/check-i18n-call-site-keys.mjs` (objectui#3530) measured 54 keys that a
`t()` call site asks for and that **no locale pack defined** — 54 distinct keys at
54 call sites across the console's six auth pages. All 54 carried an inline
`t(key, { defaultValue: 'English' })`, which is exactly the objectui#3517 class:
English rendered correctly, and **all ten languages were stuck on it** for
months. Nothing here rendered a raw key — slice one (PR #3583) held those sites.

What that meant on the page: a `zh` user reaching `/login` and switching to the
phone/SMS branch got "Email or phone number", "Get code", "Resend in {seconds}s"
and "Sign in with password instead" in English; the whole `/oauth/consent` screen
— including the four scope sentences describing what a third-party client is
about to be granted — was English-only; so was the `/accept-invitation` page and
the device-authorization dead end.

- **`packages/i18n/src/locales/en.ts`** gains the 54 keys. `oauth.consent.*` and
  `acceptInvitation.*` are new top-level namespaces; the other 26 extend
  `auth.login`, `auth.forgotPassword`, `auth.device` and `auth.verifyEmail`.
  Every one of the 52 keys whose call site carries a **string** `defaultValue`
  gets that exact string, byte for byte (52/52, script-compared), so the pack
  path and the inline-default path cannot diverge. The two remaining keys —
  `oauth.consent.title` / `oauth.consent.request` — have **template**
  defaultValues, where byte identity is structurally impossible (JS `${…}` vs
  i18next `{{…}}`); both take the interpolation contract the call site actually
  declares in its options.
- **The nine other packs** get real translations, each evidenced against a
  neighbour key in the same pack (fr's space before `?`/`:`, de's en dash, ru's
  ё, ar's verb-first placement so an RTL sentence does not open on a Latin
  client name, zh's full-width punctuation). The one string all ten packs share
  is `phonePlaceholder` — the E.164 example number, treated like the
  `name@example.com` the packs already keep untranslated.
- **`scripts/i18n-call-site-key-baseline.json`** loses exactly those 54 entries
  (163 → 109). The file is a ratchet: an unfixed key missing from it fails the
  build, and a fixed key still listed fails it too.
- **No component changed.** An AST sweep of all 122 call sites in these three
  namespaces found zero dead `t(key) || 'English'` fallbacks (the construct
  slice one had to delete from `ObjectView.tsx`, where i18next's key-as-value
  return made `||` unreachable).

Two holes here are **not** i18next's and must survive translation intact:
`resendOtpCountdownText` carries `{seconds}` in single braces because
`packages/auth/src/LoginForm.tsx` and `ForgotPasswordForm.tsx` substitute it with
a literal `.replace()`, and `oauth.consent.request`'s `{{suffix}}` arrives
pre-formatted from the page. Both are pinned in
`packages/i18n/src/__tests__/auth-namespace-3546.test.tsx`, in both directions.
