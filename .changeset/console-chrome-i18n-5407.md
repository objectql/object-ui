---
'@object-ui/components': minor
'@object-ui/fields': minor
'@object-ui/plugin-detail': patch
'@object-ui/i18n': patch
---

Console chrome i18n gaps (objectstack#5407).

- A dependency-gated lookup now names its controlling field by its **label**
  instead of its raw API name. The sentence was localized but the interpolated
  name was not, so every locale — English included — read `Select crm_account
  first`. The form renderer passes a new `dependsOnLabels` widget prop (the
  lookup-side counterpart of `emptyHint`, which it already resolves to labels
  for the fixed-option widgets); a name the host does not cover still falls
  back to itself.
- The page-header overflow trigger's `More actions` accessible name now reads
  `detail.moreActions`, the same key `action:menu`'s own overflow trigger uses,
  so the two cannot diverge per locale.
- The activity-feed reaction button's `Add reaction` accessible name is now a
  bundle key (`detail.addReaction`, added to all ten packs).
- The "check the highlighted fields" toast joins field names with a per-locale
  separator (`validation.formInvalidJoiner`) instead of a hardcoded `、`
  (U+3001) — right for zh/ja by accident, wrong in English and every Latin
  locale. Latin packs use `, `, CJK `、`, Arabic `، `.
- The Spanish `validation.required` / `validation.unique` templates gained
  their own masculine head noun (`El campo {{field}} es obligatorio`) so the
  adjective agrees for feminine field labels too — `Cuenta es obligatorio` was
  ungrammatical.
