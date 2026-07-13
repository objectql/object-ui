---
"@object-ui/auth": minor
"@object-ui/console": patch
---

feat(auth): phone number + password sign-in on the login page

The login page's password mode now accepts an **email OR a phone number** as the
identifier and routes by shape — email → `/sign-in/email`, phone →
`/sign-in/phone-number` (better-auth phoneNumber plugin, framework#2780). It
coexists with the existing phone-OTP mode.

- Gated on `features.phoneNumber` (phoneNumber plugin enabled). Unlike phone-OTP
  it needs no SMS service, so it uses that coarser capability flag, not
  `features.phoneNumberOtp`. When the flag is off the field stays email-only.
- New `AuthClient.signInWithPhonePassword(phoneNumber, password)` wired through
  `AuthContext` / `AuthProvider` / `useAuth`.
- New `normalizePhoneIdentifier` / `looksLikePhoneIdentifier` helpers that mirror
  the backend's `normalizePhoneNumber` exactly (strip `[\s\-().]`, validate
  `^\+?[0-9]{6,15}$`, **no** forced E.164 / country code — the backend stores the
  light-stripped form, so anything heavier would break the lookup).
- SSO stays email-only (a phone-shaped identifier no longer attempts domain
  routing).

Only works for accounts that have both a phone number and a password set;
phone-only accounts set a password on first OTP sign-in.
