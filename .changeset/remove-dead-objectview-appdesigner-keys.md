---
'@object-ui/i18n': patch
---

Removed five locale keys that had no call site in any package, app, example,
or e2e test: `console.objectView.striped`, `console.objectView.bordered`,
`console.objectView.virtualScroll`, `appDesigner.stripedRows`, and
`appDesigner.bordered`. Deleted from all ten packs (`en` plus the nine
translations) to keep `all-locales-key-parity.test.ts` green.

The `console.objectView.*` three describe grid options ObjectStack retired
upstream (objectstack#7176, 2026-08-10) and objectui stopped forwarding
(objectui#4649); the `appDesigner.*` pair is textually identical in name only
and was independently dead — no `AppCreationWizard.tsx` control, no fallback
entry in `useDesignerTranslation.ts`'s `DESIGNER_DEFAULT_TRANSLATIONS`, and no
mention anywhere in the repo outside the locale packs themselves.

No runtime behavior changes: nothing rendered these labels before this patch.
