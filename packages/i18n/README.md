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
- `react-dom` ^18.0.0 || ^19.0.0

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
      <button onClick={() => changeLanguage('zh')}>中文</button>
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

<!-- release-metadata:v3.3.0 -->

## Compatibility

- **React:** 18.x or 19.x
- **Node.js:** ≥ 18
- **TypeScript:** ≥ 5.0 (strict mode)
- **`@objectstack/spec`:** ^3.3.0
- **`@objectstack/client`:** ^3.3.0
- **Tailwind CSS:** ≥ 3.4 (for packages with UI)

## Links

- 📚 [Documentation](https://www.objectui.org/docs/packages/i18n)
- 📦 [npm package](https://www.npmjs.com/package/@object-ui/i18n)
- 📝 [Changelog](./CHANGELOG.md)
- 🐛 [Report an issue](https://github.com/objectstack-ai/objectui/issues)
- 🤝 [Contributing Guide](https://github.com/objectstack-ai/objectui/blob/main/CONTRIBUTING.md)
- 🗺️ [Roadmap](https://github.com/objectstack-ai/objectui/blob/main/ROADMAP.md)

## License

MIT — see [LICENSE](./LICENSE).
