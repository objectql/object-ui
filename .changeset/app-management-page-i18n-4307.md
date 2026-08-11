---
'@object-ui/i18n': patch
'@object-ui/console': patch
---

The console's Applications page is localized — its own chrome only, never the
server's words (objectui#4307).

`AppManagementPage` was raw English end to end: headings, the search field, the
selection and bulk controls, the six per-row actions with their tooltip/ARIA
pairs, the status badges, and every toast. It was the last un-i18n'd system page,
and #4233 / PR #4300 had just given it four live mutations — so the gap became
user-visible on every non-English console at the moment operators started using
it. 45 keys land under `appManagement.*` in all ten packs, reached through
`useObjectTranslation` with the call site's `defaultValue` inline, which is the
convention the neighbouring system pages already follow.

The split that shapes this change is between the strings the PAGE authors and
the strings the SERVER authors. `PUT`/`DELETE /api/v1/meta/app/:name` is gated on
`manage_metadata` (ADR-0066 D1), so a refusal like `forbidden: manage_metadata
required` is the server's diagnosis of one specific request; there is no fixed
catalogue of those sentences to key against. Each failure toast is therefore a
keyed template with a `{{reason}}` hole, and what fills the hole is passed
through byte for byte, untranslated. The one part that IS the page's own — what
it says when the server sent no message at all — is keyed as
`appManagement.toast.unknownError`.

Two smaller things follow from doing the conversion properly rather than
mechanically. The per-failure entry of a bulk toast and the separator between
entries are keys, not literals, because bracket style and list punctuation are
locale properties (the same rule, and the same past defect, as
`validation.formInvalidJoiner`). And the row's controls now name an app through
the resolver the visible heading two lines away already used, with `t` passed:
an app carrying objectui's keyed label form previously rendered `Select [object
Object]` into its checkbox's ARIA label.
