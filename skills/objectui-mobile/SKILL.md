---
name: objectui-mobile
description: Implement mobile-responsive features in Object UI apps. Use this skill when the user asks to implement responsive mobile views, optimize touch interactions, handle mobile viewport issues, add offline support, build mobile-first pages, or configure PWA features. Also applies when the user mentions useBreakpoint, touch gestures, swipe actions, bottom sheets, mobile navigation, breakpoint-based layouts, pull-to-refresh, or asks "how to make this work on mobile" or "it looks broken on phones".
---

# ObjectUI Mobile

Use this skill to add mobile-responsive features to Object UI applications via the `@object-ui/mobile` package.

## useBreakpoint hook

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

## Touch gesture handling

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

## Bottom sheet and mobile navigation

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

## Responsive schema layouts

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

## Mobile-first Tailwind classes in schemas

```json
{
  "type": "grid",
  "className": "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4"
}
```

## Mobile-optimized form inputs

```typescript
import { MobileSelect, MobileDatePicker } from '@object-ui/mobile';

// MobileSelect uses native <select> on mobile for better UX
// MobileDatePicker uses native date input on mobile
```

## Offline support

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

## Viewport considerations

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

## Common mistakes

- Using fixed pixel widths in schemas — breaks on small screens. Use Tailwind responsive classes.
- Testing only on desktop viewport — always verify mobile breakpoint behavior.
- Using hover-only interactions — touch devices need tap-friendly alternatives.
- Not handling offline state — forms lose data when network drops.
