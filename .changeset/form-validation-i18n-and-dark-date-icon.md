---
'@object-ui/components': patch
'@object-ui/fields': patch
---

Localize form validation messages and make native date/time picker icons legible in dark mode.

Record-form validation messages (required, min/max length, min/max value, pattern, email, URL) were hard-coded English even when the field label was localized — e.g. a Chinese "计划开始日期" field showed "计划开始日期 is required". `buildValidationRules` baked English strings, so the form renderer's `t(...)` fallback never applied. It now emits `required: true` and, for the other rules, a `messageKey` + `undefined` message (a field-authored `*_message` still wins and passes through verbatim); the form renderer fills the blanks via i18n (`validation.*` keys already exist in every locale), so messages track the label's language.

Separately, native controls now declare `color-scheme` (`light` on `:root`, `dark` on `.dark`), so the webkit calendar-picker-indicator and other built-in glyphs render light-on-dark instead of vanishing against the dark input background.
