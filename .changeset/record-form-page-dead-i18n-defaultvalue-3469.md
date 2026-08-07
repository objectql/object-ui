---
"@object-ui/app-shell": patch
---

`RecordFormPage` no longer passes an inline `defaultValue` to the seven `t()`
lookups whose keys are defined in all ten locale packs (`form.createTitle`,
`form.editTitle`, `form.createSuccess`, `form.updateSuccess`,
`form.saveRecord`, `common.back`, `common.cancel`). Rendered copy is
unchanged in every locale — those branches were unreachable, because
`all-locales-key-parity.test.ts` pins the keys as present, so i18next always
resolved the pack value and never consulted the fallback (objectui#3469).

What the dead fallbacks *did* do is carry a second, unwatched English
spelling of the same string. `form.createTitle`'s default read
`New {object}` while the pack says `Create {{object}}` — a different verb for
one title at one call site. Had the key ever been renamed or dropped, the page
title would have silently changed from "Create Contacts" to "New Contacts"
with the whole suite still green. Now a missing key surfaces as the raw key
plus the dev missing-key warning, and a new
`RecordFormPage.i18n.test.tsx` asserts both that the rendered copy is the pack
copy (checked in `en` and `zh`, which no hardcoded English default could
satisfy) and that every bare key really exists in all ten packs.

One `defaultValue` in the file is deliberately kept: `form.createTargetOrg`
(the group-tenancy write-target badge) is defined in **no** pack, not even
`en`, so its fallback is what actually renders. It is now documented as the
exception and pinned by a test that says to remove it when the key is
backfilled.
