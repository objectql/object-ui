---
name: objectui-i18n-mobile
description: Implement internationalization (i18n) and mobile-responsive features in Object UI apps. Use this skill when the user asks to add multi-language support, translate UI labels, configure RTL (right-to-left) layouts for Arabic/Hebrew, implement responsive mobile views, optimize touch interactions, handle mobile viewport issues, add offline support, or build mobile-first pages. Also applies when the user mentions language switching, locale formatting (dates, currencies, numbers), breakpoint-based layouts, mobile gestures, PWA features, or asks "how to make this work on mobile".
---

# ObjectUI i18n & Mobile

Use this skill to add multi-language support and mobile-responsive features to Object UI applications. These two capabilities are combined because mobile apps frequently need i18n, and both affect the same UI rendering layer.

## Internationalization (`@object-ui/i18n`)

### Setup

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

### Built-in locales

The package includes translations for:
- English (`en`), Chinese (`zh`), Japanese (`ja`), Korean (`ko`)
- German (`de`), French (`fr`), Spanish (`es`), Portuguese (`pt`)
- Russian (`ru`), Arabic (`ar`)

### useObjectTranslation hook

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

### Lazy language loading

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

### RTL (right-to-left) support

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

### Number, date, and currency formatting

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

### Schema-level i18n

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

## Mobile (`@object-ui/mobile`)

### useBreakpoint hook

```typescript
import { useBreakpoint } from '@object-ui/mobile';

function ResponsiveLayout() {
  const { breakpoint, isMobile, isTablet, isDesktop } = useBreakpoint();

  if (isMobile) {
    return <MobileLayout />;
  }
  return <DesktopLayout />;
}
```

Breakpoint values follow Tailwind defaults:
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Touch gesture handling

```typescript
import { useSwipe, useLongPress, usePinchZoom } from '@object-ui/mobile';

function MobileCard() {
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => showActions(),
    onSwipeRight: () => dismiss(),
    threshold: 50,
  });

  const longPressHandlers = useLongPress({
    onLongPress: () => openContextMenu(),
    delay: 500,
  });

  return (
    <div {...swipeHandlers} {...longPressHandlers}>
      <CardContent />
    </div>
  );
}
```

### Bottom sheet and mobile navigation

```typescript
import { BottomSheet, MobileNav } from '@object-ui/mobile';

function MobileApp() {
  return (
    <>
      <MobileNav items={navItems} />
      <MainContent />
      <BottomSheet
        open={showFilters}
        onClose={() => setShowFilters(false)}
        snapPoints={[0.5, 0.9]}
      >
        <FilterPanel />
      </BottomSheet>
    </>
  );
}
```

### Responsive schema layouts

Use responsive column configurations in grid layouts:

```json
{
  "type": "grid",
  "props": {
    "cols": { "sm": 1, "md": 2, "lg": 4 }
  },
  "children": [
    { "type": "card", "props": { "title": "KPI 1" } },
    { "type": "card", "props": { "title": "KPI 2" } },
    { "type": "card", "props": { "title": "KPI 3" } },
    { "type": "card", "props": { "title": "KPI 4" } }
  ]
}
```

### Mobile-optimized form inputs

```typescript
import { MobileSelect, MobileDatePicker } from '@object-ui/mobile';

// MobileSelect uses native <select> on mobile for better UX
// MobileDatePicker uses native date input on mobile
```

### Offline support

```typescript
import { useOffline } from '@object-ui/react';

function DataForm() {
  const { isOnline, queue, syncState } = useOffline();

  // When offline, mutations are queued
  // When back online, queued mutations are synced automatically

  return (
    <div>
      {!isOnline && <Banner>You are offline. Changes will sync when connected.</Banner>}
      {syncState === 'syncing' && <Spinner />}
      <FormContent />
    </div>
  );
}
```

Sync states: `idle` → `syncing` → `synced` | `error`

### Viewport considerations

For mobile apps, ensure the HTML template includes proper viewport meta:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
```

Prevent zoom on input focus (iOS):
```css
input, select, textarea {
  font-size: 16px; /* Prevents auto-zoom on iOS */
}
```

## Common patterns

### Language-aware + responsive page

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

### Mobile-first Tailwind classes in schemas

```json
{
  "type": "grid",
  "className": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
}
```

## Common mistakes

- Using fixed pixel widths in schemas — breaks on small screens. Use Tailwind responsive classes.
- Bundling all locale files upfront — use lazy loading for apps with many languages.
- Forgetting `dir={direction}` on root elements — RTL layout won't apply.
- Testing only on desktop viewport — always verify mobile breakpoint behavior.
- Using hover-only interactions — touch devices need tap-friendly alternatives.
- Not handling offline state — forms lose data when network drops.
