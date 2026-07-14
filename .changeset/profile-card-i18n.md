---
'@objectstack/console': patch
'@object-ui/i18n': patch
'@object-ui/app-shell': patch
'@object-ui/plugin-detail': patch
'@object-ui/plugin-tree': patch
---

i18n: translate the Profile page, honor inline i18n label objects under bare
base-language codes, and localize managed-by badges / record quick actions.

- `pickLocalized` now upgrades a bare base language (`zh`) to any
  region-qualified key sharing the base (`zh-CN`) — runtime language is
  normalized to the base code while metadata authors write full BCP-47 tags,
  so inline `{ en, 'zh-CN', ... }` label objects previously fell back to
  English.
- ProfilePage (`account:profile_card` / `/system/profile`): every hardcoded
  string — page title/subtitle, avatar Upload/Replace/Remove, Personal
  Information card, Change/Set Password card — now goes through
  `useObjectTranslation()` with `profile.*` keys (new namespace in all ten
  locale bundles); the lazy-load fallback reuses `common.loading`.
- `ManagedByBadge` chips/tooltips (Config/System/Append-only/Identity) now
  resolve through new `managedByBadge.*` keys with `{{provider}}`
  interpolation.
- `record:quick_actions` resolves action labels via the
  `objects.{object}._actions.{action}.label` convention plus `pickLocalized`,
  so object action buttons (Change Password, Enable 2FA, …) localize.
- `record:details` / `record:related_list` / `record:alert` / `ObjectTree`
  pass inline label objects through `pickLocalized`.
- Locale bundles: added `managedByBadge` namespace to all ten locales and
  backfilled `list.inlineEditShort` / `inlineEditLabel` /
  `recordEditingTitle` for ja/es/ko/de/fr/pt/ru/ar.
