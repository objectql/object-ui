---
"@object-ui/plugin-grid": patch
"@object-ui/i18n": patch
---

fix(grid): localize import result errors (objectstack#3566)

The import completion screen rendered the raw English server message verbatim —
e.g. `Row 6 (position): position: "装配工" matches more than one
os_tianshun_ehr_position — use a unique value or the record id` — with the field
name twice, an internal object api-name, all in English, while the dry-run panel
already localized the same errors.

- The result list now runs through the same `formatDryRunError` path (driving
  off the structured error `code`, resolving the api-name to its field label,
  dropping the duplicated `<api-name>:` prefix). Threaded the error `code`
  through `ImportResult.errors` to make this possible.
- Added code-driven translations for the remaining structured import errors —
  `invalid_boolean` / `invalid_number` / `invalid_date` / `invalid_option` /
  `required` / `AMBIGUOUS_MATCH` — with Chinese (`zh`) copy in `@object-ui/i18n`
  alongside the existing reference errors.
