---
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
---

The group-tenancy write-target badge is now translated in all ten locales (objectui#3517)

`form.createTargetOrg` — the ADR-0105 badge `RecordFormPage` shows in create mode
to name the organization a new record will land in — was defined in **no** locale
pack, not even `en`. i18next therefore genuinely missed the key and rendered the
call site's inline `defaultValue`, so the badge read English `Creates in <org>` in
all ten languages: a Chinese console creating a record on an org-walled object
showed `Creates in 某某组织`.

`all-locales-key-parity.test.ts` could not see this. It asserts that every pack
defines every **`en`** key, so a key `en` itself lacks is outside the comparison —
ten packs missing it identically kept parity fully green.

## What changed

- `createTargetOrg` is backfilled into `en` as `Creates in {{org}}`, which makes
  the parity gate demand it from the other nine; each is translated to its pack's
  existing `form`-section tone rather than copied or machine-filled.
- The inline `defaultValue` in `RecordFormPage.tsx` is deleted, finishing what
  objectui#3469 started — that key was the file's last remaining exception, and
  every `t()` on the page now passes bare. Declared = enforced: the packs are the
  single source of this copy, and a missing key must surface (raw key + dev
  missing-key warning) instead of being papered over at the call site.
- The two exception-pinning tests objectui#3516 left behind invert. `form.createTargetOrg`
  joins the `BARE_KEYS` list (pinned present in all ten packs), and the render
  assertion now checks the badge against the **pack** copy in both `en` and `zh` —
  the deleted English default could not satisfy the Chinese assertion, so the
  badge fails loudly if the packs ever stop driving it.
