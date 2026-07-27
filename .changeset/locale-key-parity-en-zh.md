---
"@object-ui/i18n": patch
"@object-ui/plugin-grid": patch
"@object-ui/console": patch
---

fix(i18n): make `en` the complete source of truth for grid import and set-password (objectui#2872 b/c)

The `en` and `zh` packs had drifted in both directions, silently, because
`fallbackLng: 'en'` degrades a missing key into English rather than an error and
the missing-key handler only fires in dev.

- **74 keys existed only in `zh`.** `grid.import.*` and `auth.setPassword.*` had
  never been added to `en`, so no other locale could translate them: the English
  text came from call-site `defaultValue:` args and a private map inside
  `ImportWizard`. They now live in `en`, which is what translators and
  `os i18n extract` read.
- **4 `en` keys were missing from `zh`** (`console.commandPalette.title`,
  two `console.ai.suggestions.metadataAssistant.*`, `help.keyboardShortcuts`),
  so Chinese users saw English.

`grid.import` in particular had three disagreeing sources — the `en` pack (62
keys), `zh` (130) and `ImportWizard`'s own fallback map (133), union 134, no two
the same set. All three are now aligned on 134.

The wizard's fallback map is kept, not deleted: it is what lets the wizard render
with no `I18nProvider` mounted (standalone embedding, unit tests). It is instead
pinned to the `en` pack by a new test, so the two can no longer drift.

`SetPasswordPage` drops its now-redundant inline `defaultValue:` args; the text
is byte-identical, it just comes from the pack now.

Adds two guards, both mutation-verified:
- `en` ↔ `zh` full key parity, asserted in both directions. The other eight
  packs are still ~357 keys behind and are tracked separately (objectui#2872
  part a), so they are deliberately not asserted yet.
- `IMPORT_DEFAULT_TRANSLATIONS` ↔ `en.grid.import`, same keys and same text.
