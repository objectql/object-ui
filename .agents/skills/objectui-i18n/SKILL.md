---
name: objectui-i18n
description: Implement internationalization (i18n) in Object UI apps. Use this skill when the user asks to add multi-language support, translate UI labels, configure RTL (right-to-left) layouts for Arabic/Hebrew, implement language switching, lazy-load locale files, format dates/numbers/currencies by locale, or localize JSON schemas. Also applies when the user mentions useObjectTranslation, I18nProvider, locale formatting, translation keys, or asks "how do I add Chinese/Japanese/etc support".
---

# ObjectUI Internationalization (i18n)

Use this skill to add multi-language support to Object UI applications via the `@object-ui/i18n` package.

## Setup

```typescript
import { I18nProvider, createI18n } from '@object-ui/i18n';

const i18n = createI18n({
  defaultLanguage: 'en',
  fallbackLanguage: 'en',
  detectBrowserLanguage: true,  // Auto-detect from navigator
  resources: {
    en: { common: { save: 'Save', cancel: 'Cancel' } },
    zh: { common: { save: '保存', cancel: '取消' } },
  },
});

function App() {
  return (
    <I18nProvider instance={i18n}>
      <AppContent />
    </I18nProvider>
  );
}
```

## Built-in locales

The package includes translations for:
- English (`en`), Chinese (`zh`), Japanese (`ja`), Korean (`ko`)
- German (`de`), French (`fr`), Spanish (`es`), Portuguese (`pt`)
- Russian (`ru`), Arabic (`ar`)

## useObjectTranslation hook

```typescript
import { useObjectTranslation } from '@object-ui/i18n';

function Header() {
  const { t, language, changeLanguage, direction } = useObjectTranslation();

  return (
    <header dir={direction}>
      <h1>{t('common.appTitle')}</h1>
      <select value={language} onChange={(e) => changeLanguage(e.target.value)}>
        <option value="en">English</option>
        <option value="zh">中文</option>
        <option value="ar">العربية</option>
      </select>
    </header>
  );
}
```

## Lazy language loading

For large apps, load translations on demand instead of bundling all locales:

```typescript
<I18nProvider
  config={{ defaultLanguage: 'en' }}
  loadLanguage={async (lang) => {
    const module = await import(`./locales/${lang}.json`);
    return module.default;
  }}
>
  <AppContent />
</I18nProvider>
```

## RTL (right-to-left) support

RTL is automatic for Arabic, Hebrew, and other RTL languages. The provider updates `document.dir` when the language changes.

```typescript
const { direction } = useObjectTranslation();
// direction: 'ltr' | 'rtl'
```

For Tailwind layout adjustments, use RTL-aware utilities:

```html
<!-- Automatically mirrors in RTL -->
<div className="ml-4 rtl:mr-4 rtl:ml-0">
  <span className="text-left rtl:text-right">Content</span>
</div>
```

## Number, date, and currency formatting

```typescript
import { useObjectTranslation } from '@object-ui/i18n';

function PriceDisplay({ amount, currency, date }) {
  const { formatCurrency, formatDate, formatNumber, formatRelativeTime } = useObjectTranslation();

  return (
    <div>
      <p>{formatCurrency(amount, currency)}</p>        {/* $1,234.56 or ¥1,234.56 */}
      <p>{formatDate(date, 'YYYY-MM-DD')}</p>           {/* 2024-03-15 */}
      <p>{formatNumber(1234567)}</p>                      {/* 1,234,567 or 1.234.567 */}
      <p>{formatRelativeTime(date)}</p>                   {/* "3 days ago" */}
    </div>
  );
}
```

## Schema-level i18n

In Object UI schemas, use plain string labels (per `@objectstack/spec` v4). For multi-language support, resolve translations before passing to SchemaRenderer:

```typescript
const { t } = useObjectTranslation();

const localizedSchema = {
  type: 'card',
  props: {
    title: t('customers.title'),
    description: t('customers.description'),
  },
  children: [
    { type: 'button', props: { label: t('common.save') } },
    { type: 'button', props: { label: t('common.cancel') } },
  ],
};
```

## Language-aware + responsive page

When combining with `@object-ui/mobile` for responsive layouts:

```typescript
import { I18nProvider } from '@object-ui/i18n';
import { useBreakpoint } from '@object-ui/mobile';
import { SchemaRendererProvider, SchemaRenderer } from '@object-ui/react';

function App() {
  const { isMobile } = useBreakpoint();
  const schema = isMobile ? mobilePageSchema : desktopPageSchema;

  return (
    <I18nProvider config={{ defaultLanguage: 'en' }}>
      <SchemaRendererProvider dataSource={data}>
        <SchemaRenderer schema={schema} />
      </SchemaRendererProvider>
    </I18nProvider>
  );
}
```

## Common mistakes

- Bundling all locale files upfront — use lazy loading for apps with many languages.
- Forgetting `dir={direction}` on root elements — RTL layout won't apply.
- Using `{key, defaultValue}` translation objects — `@objectstack/spec` v4 uses plain strings only.
