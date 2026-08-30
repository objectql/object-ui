---
'@object-ui/i18n': patch
---

The German pack's `auth.device.*` in-flight states move to the passive register
(objectui#6611, triage ruling 2026-08-27, option 2): `approving` `Genehmige…` →
`Wird genehmigt…`, `denying` `Ablehne…` → `Wird abgelehnt…`, `loading` `Lade…` →
`Wird geladen…`.

Graded a bug, not a taste call: `Ablehne…` was not a grammatical German form.
`ablehnen` is a separable-prefix verb, so the first-person singular is *ich lehne
ab* — the pack shipped broken German on `DeviceAuthPage.tsx` to users today.
Re-derived the ruling's premise against the tree before touching anything: the
`de` pack's dominant in-flight register is measurably the passive — 40 of 61
`en`-bare-gerund keys render `Wird …`, against 21 that don't (a Unicode-aware,
position-aware scan, positive-controlled on `common.loading` → `Wird geladen…`),
close to triage's "roughly 37" and the same conclusion either way. `loading` was
the sole member of objectui#5972's merged `Loading…` group carved out by name in
`LOADING_GROUP_FORKS` (`packages/i18n/src/__tests__/ellipsis-glyph-3878.test.ts`),
because converging it alone while `approving`/`denying` stayed first-person would
have manufactured a new same-screen inconsistency. Moving the whole namespace to
the passive removes that fork rather than maintaining it, so the exemption row is
deleted and the pin now asserts zero forks.

No key added or removed, no `en` value moves, no other locale touched.
