---
"@object-ui/i18n": patch
"@object-ui/app-shell": patch
---

fix(auth): localize the ADR-0069 remediation gate and the auth split-panel (#2870)

`RemediationOverlay` had no i18n at all. It is the full-screen gate mounted
unconditionally at `ConsoleShell` (`fixed inset-0 z-[200]`) that a user hits
when the backend returns `PASSWORD_EXPIRED` or `MFA_REQUIRED` — there is no
route around it, so a user who could not read English could not get back into
the product. That makes it a usability block rather than a cosmetic gap.

- New `auth.remediation.*` namespace in all ten locale packs, covering both
  branches of the gate: expired-password (title, three field labels, submit /
  submitting, mismatch and failure messages) and MFA enrolment (password step,
  QR scan copy, backup-code disclosure, code entry, verify / verifying, and the
  enrolment and invalid-code failures), plus the shared "sign out instead" exit.
- Validation and failure messages are translated where they are raised, since
  they are held in component state and rendered later.
- The server-provided `remediationRequired.message` is left untouched; only the
  empty-message fallback is localized.
- `AuthPageLayout`'s two marketing strings move to `auth.layout.*`. The forms it
  wraps were already localized, so the split-panel had been rendering half in
  the user's language and half in English.

Adds a locale-parity test over both namespaces, asserting an identical key set
across all ten packs, a non-empty string at every leaf, and that prose differs
from English (short labels like "Continue" legitimately collide). i18next falls
back to `en` silently and its missing-key handler is dev-only, so a key added to
one pack and forgotten elsewhere is invisible in whichever locales get tested by
hand.
