# @object-ui/i18n

Internationalization for Object UI — 11 built-in locales, RTL support, and date/currency formatting.

## Features

- 🌍 **11 Built-in Locales** - English, Chinese, Japanese, Korean, German, French, Spanish, Portuguese, Russian, Arabic, and more
- 🔄 **RTL Support** - Automatic right-to-left layout for Arabic and other RTL languages
- 📅 **Date Formatting** - Locale-aware date, datetime, and relative time formatting
- 💰 **Currency & Number Formatting** - Locale-aware currency and number formatting
- 🎣 **React Hooks** - `useObjectTranslation` for translations, language switching, and direction
- 🏗️ **I18nProvider** - Context provider for internationalized applications
- 🔌 **Extensible** - Add custom locales and translation keys
- 🎯 **Type-Safe** - Full TypeScript support with exported types

## Installation

```bash
npm install @object-ui/i18n
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { I18nProvider, useObjectTranslation } from '@object-ui/i18n';

function App() {
  return (
    <I18nProvider config={{ defaultLanguage: 'en' }}>
      <MyComponent />
    </I18nProvider>
  );
}

function MyComponent() {
  const { t, language, changeLanguage, direction } = useObjectTranslation();

  return (
    <div dir={direction}>
      <h1>{t('common.save')}</h1>
      <button onClick={() => changeLanguage('zh')}>Chinese</button>
      <button onClick={() => changeLanguage('ar')}>العربية</button>
    </div>
  );
}
```

## API

### I18nProvider

Wraps your application with i18n context:

```tsx
<I18nProvider config={{ defaultLanguage: 'en', fallbackLanguage: 'en' }}>
  <App />
</I18nProvider>
```

#### Language persistence

The active language is a **user preference**, so it survives a reload: every
language change is written to `localStorage` under `objectui-locale`
(`LOCALE_STORAGE_KEY`), and the provider boots the next session in that
language.

Precedence at bootstrap: **stored choice → browser language → `defaultLanguage`**.
An explicit choice outranks browser detection — otherwise a user who picked 中文
on a `ja` browser would be handed `ja` back on every reload. A stored value the
app no longer offers (not a built-in pack, not in `config.resources`) is ignored
*and purged*, so a stale entry can never lock the UI to a locale with no
translations.

```tsx
// Fixed-language surfaces (previews, demos, screenshot harnesses) opt out —
// they neither restore nor write the preference.
<I18nProvider config={{ defaultLanguage: 'en' }} persistLanguage={false}>
  <Preview />
</I18nProvider>
```

Bringing your own `instance`? Then its bootstrap language is yours to choose —
read the preference with `readStoredLanguage()` and pass it to `createI18n`.
Switching through such an instance is still persisted.

### useObjectTranslation

Hook for translations and language management:

```tsx
const { t, language, changeLanguage, direction } = useObjectTranslation();
```

### createI18n

Factory for creating an i18n instance outside React:

```tsx
import { createI18n } from '@object-ui/i18n';

const i18n = createI18n({ defaultLanguage: 'de' });
i18n.t('common.cancel'); // "Abbrechen"
```

### Formatting Utilities

Locale-aware formatting functions:

```tsx
import { formatDate, formatCurrency, formatNumber, formatRelativeTime } from '@object-ui/i18n';

formatDate(new Date(), 'en');            // "Jan 1, 2025"
formatCurrency(99.99, 'USD', 'en');      // "$99.99"
formatNumber(1234567, 'de');             // "1.234.567"
formatRelativeTime(-3, 'days', 'en');    // "3 days ago"
```

### Built-in Locales

Import individual locale packs:

```tsx
import { en, zh, ja, ko, de, fr, es, pt, ru, ar } from '@object-ui/i18n';
```

### RTL Helpers

```tsx
import { isRTL, RTL_LANGUAGES } from '@object-ui/i18n';

isRTL('ar'); // true
isRTL('en'); // false
```

## Scope — the `engine.*` carve-out (metadata-admin / Studio)

Not every user-facing string in this repository resolves through these packs.
The metadata-admin (Studio) surface — the metadata directory, the inspectors,
package management, the flow designer and their refusal messages — resolves its
`engine.*` keys through a module-local **two-locale** table in
[`packages/app-shell/src/views/metadata-admin/i18n.ts`](../app-shell/src/views/metadata-admin/i18n.ts):
a plain `Record` lookup over `en-US` and `zh-CN`, not an i18next namespace.
Roughly 1,300 keys per locale live there, and **no `engine.*` key exists in any
of the ten packs.**

That is design, not drift — the file's header records it as "Phase 3f". The
server holds the primary path: the engine consumes `label` from the
`/meta/types` response, sourced from the platform's metadata-type registry. The
module-local table is a **fallback** for deployments with no translation bundles
configured, and the interim source of truth for Chinese until the platform's
`setup.translation.ts` ships zh-CN coverage. Copying the namespace into the
packs would duplicate strings whose primary source is a server response.

Two consequences follow, and both are accepted rather than outstanding work:

- **Only `en` and `zh` are covered.** On an `ar` / `de` / `es` / `fr` / `ja` /
  `ko` / `pt` / `ru` console, `engine.*` strings render English. That is the
  price of the carve-out, not a backfill someone forgot.
- **The i18n gates cannot see this namespace, by construction.** Key parity
  ([`src/__tests__/all-locales-key-parity.test.ts`](./src/__tests__/all-locales-key-parity.test.ts))
  compares pack against pack, and `engine.*` is in no pack — so it is not an
  *exception* to that test, it is outside its subject. The call-site gate
  ([`scripts/check-i18n-call-site-keys.mjs`](../../scripts/check-i18n-call-site-keys.mjs))
  skips these call sites **by declaration**: the module is registered in its
  `EXCLUDED_TRANSLATORS` list with a reason, and an imported `t` from any
  unregistered module is a hard error there — so a second local table cannot
  appear silently, and this carve-out cannot quietly widen.

**When to revisit.** Migrating the namespace into the packs is mechanical but
wide (~1,300 keys × 8 further locales) and argues against the server-driven
design above, so it is not worth doing speculatively. The condition to reopen it
is concrete: a stated demand for an admin console in a language other than `en`
or `zh` — not a general wish for broader locale coverage, which the packs
already serve on every other surface. See objectui#4662 for the measurement and
the ruling.

## Links

- 📦 [npm package](https://www.npmjs.com/package/@object-ui/i18n)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
