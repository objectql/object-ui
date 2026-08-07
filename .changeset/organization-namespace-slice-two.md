---
'@object-ui/i18n': patch
---

The organization-management console is translatable. The 90 keys under
`organization.*` — the org layout and its tabs, the members list, the whole
invitation flow, organization settings including the leave and delete
confirmations, the accept-invitation page, and the workspace switcher — are now
defined in all ten locale packs, so a non-English session reads the org admin
surface in its own language instead of English (part of #3546).

`scripts/check-i18n-call-site-keys.mjs` measured 258 keys that a `t()` call site
asks for and no pack defines. `organization.*` was the largest namespace in that
tally at 90 keys across 93 call sites in seven components. Every one of them
carried an inline `t(key, { defaultValue: 'English' })`, which is why nothing
looked broken: English rendered correctly at each site and all ten languages
were pinned to it. That is the #3517 class, not the raw-key class slice one
(#3583) held — no organization site rendered an identifier, and none had a dead
`||` fallback to remove, which was measured before deciding not to touch the
components.

Adding a `defaultValue` is deliberately not the fix; it is the mechanism that
kept these invisible for months. The existing defaults stay where they are, and
each `en` value is byte-identical to the default at its call site so the two
paths cannot render different text.

`organization` is a new top-level namespace, sitting next to — and distinct
from — `organizations`: the singular one is the management surface, the plural
one the org picker. The ratchet in `scripts/i18n-call-site-key-baseline.json`
shrinks by exactly these 90 entries, from 253 to 163. The
`organization.invitations.status.*` template-key family is untouched and still
baselined: enumerating an invitation status set is a different repair from
backfilling literal keys.
