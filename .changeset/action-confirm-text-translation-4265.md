---
'@object-ui/react': patch
'@object-ui/components': patch
'@object-ui/plugin-detail': patch
'@object-ui/app-shell': patch
---

Action confirm dialogs and success toasts now honour the bundle's translated
`confirmText` / `successMessage`, not just `label` (objectui#4265).

A TranslationBundle entry for an action carries three keys under one
`_actions.<name>` node — `label`, `confirmText`, `successMessage` — and
`useObjectLabel()` has always exposed a resolver for each. What had drifted was
the call sites: `page:header` (authored record pages), `record:quick_actions`
and the related-list row menu resolved the button `label` only and dispatched
the authored `confirmText` / `successMessage` untouched. One bundle entry met
two fates: the button rendered the translation, the confirm dialog rendered the
authored English.

All action-rendering surfaces now go through one resolver,
`useActionTextLocalizer()` (new, exported from `@object-ui/react`), which
applies the existing `actionLabel` / `actionConfirm` / `actionSuccess`
resolvers over the three keys together. Fallback is unchanged: with no bundle
entry — or an entry lacking a key — the authored text renders. A bundle cannot
introduce a `confirmText` or `successMessage` the metadata never declared.
