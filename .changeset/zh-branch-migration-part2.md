---
"@object-ui/i18n": patch
"@object-ui/app-shell": patch
"@object-ui/plugin-chatbot": patch
---

fix(i18n): delete the four `pick({en,zh})` clones (objectui#2871, part 2)

Four files each carried an identical private resolver:

```ts
function pick(label: I18n): string {
  const lang = document.documentElement.getAttribute('lang') || 'en';
  return lang.toLowerCase().startsWith('zh') ? label.zh : label.en;
}
```

Only Chinese was ever handled, so ja/ko/de/fr/es/pt/ru/ar silently rendered
English — and because the copy was baked into the components as inline
`{en, zh}` pairs, no translator could reach it. All four copies are deleted
along with their `I18n` type alias.

Migrated to the locale packs, **all ten languages**:

- `excelImport.*` (8 keys) — `ExcelImportBar`. The completion toast becomes a
  proper `{{count}}` / `{{object}}` interpolation instead of a template literal
  baked into both language variants.
- `cloudOnboarding.*` (5 keys) — `CloudOnboardingNext`, the Cloud welcome page.
- `aiModelStatus.*` (11 keys) — `CloudAiModelStatus`, including the
  `sourceLabel()` enum→prose helper (now `t`-driven with a `{{source}}`
  placeholder) and the three `ModelRow` labels. The conditional
  `(HTTP nnn)` fragment becomes two whole sentences rather than a string
  spliced mid-clause, which is not translatable into every word order.
- `chatbotQuota.*` (4 keys) — the AI quota banner in `ChatbotEnhanced`.

The chatbot banner keeps choosing between the server's `quota.message` (zh) and
`quota.messageEn` — that pair is server-owned — but now decides using the
console's active language instead of `navigator.language`, which had ignored
the in-app locale switcher entirely.

`CloudOnboardingNext`'s tests now render inside a real `I18nProvider`; without
one `t()` returns the raw key, so the previous assertions on literal English
were asserting nothing.

This completes the `pick()` cluster from #2871. The remaining
`startsWith('zh')` sites are the ones that classification marked KEEP —
`LoadingScreen` (bootstrap, selects real locale packs before i18next is up),
`conversationLanguage` (detects the chat's language for the agent, not UI
copy), `containers.tsx` (normalises author-supplied schema data; its `'与'`
separator is a CJK typography rule), and the Studio catalog / `field-types.ts`
data catalog.
