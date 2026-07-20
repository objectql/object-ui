---
"@object-ui/i18n": minor
"@object-ui/app-shell": patch
---

feat(i18n): localize action result dialogs via the `_actions.<action>.resultDialog` convention

The post-success secret-reveal dialog (create-user temporary password, 2FA
backup codes, OAuth client secrets) always rendered the hardcoded English
metadata literals — the spec bundles now carry `resultDialog` translations
(objectstack `_actions.<action>.resultDialog.*`), but nothing resolved them
client-side.

- **@object-ui/i18n.** `useObjectLabel()` gains `actionResultDialog(objectName,
  actionName, spec)`: overlays translated `title` / `description` /
  `acknowledge` and per-field labels onto the metadata spec, falling back to
  the literals. The `fields` node is keyed by the LITERAL result-field path
  (may contain dots, e.g. `"user.email"`), so it is fetched whole with
  `returnObjects` and indexed directly — never resolved through a dotted
  i18next key. Built-in locale packs also translate the dialog's fallback
  `defaultTitle` / `acknowledge` (previously English in all ten locales) and
  add the new `actions.resultDialog.copyAll` key.
- **@object-ui/app-shell.** The result-dialog handlers in
  `useConsoleActionRuntime` and `RecordDetailView` accept the action context
  (already passed by `ActionRunner`) and localize the spec before opening the
  dialog; `ActionResultDialog`'s hardcoded "Copy all" button now goes through
  `actions.resultDialog.copyAll`.
