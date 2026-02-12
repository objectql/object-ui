# @object-ui/mobile

Mobile optimization for Object UI — responsive hooks, gesture support, touch targets, and PWA utilities.

## Features

- 📱 **Responsive Hooks** - `useBreakpoint` and `useResponsive` for adaptive layouts
- 👆 **Gesture Support** - `useGesture` and `useSpecGesture` for swipe, pinch, and long-press detection
- 🔄 **Pull to Refresh** - Native pull-to-refresh behavior with `usePullToRefresh`
- 🎯 **Touch Targets** - `useTouchTarget` for accessible minimum-size touch areas
- 📐 **Responsive Containers** - `ResponsiveContainer` for breakpoint-aware rendering
- 🏗️ **MobileProvider** - Context provider for mobile-aware applications
- 📲 **PWA Support** - Manifest generation and service worker registration
- ⚙️ **Configurable Breakpoints** - Customizable breakpoint definitions

## Installation

```bash
npm install @object-ui/mobile
```

**Peer Dependencies:**
- `react` ^18.0.0 || ^19.0.0
- `react-dom` ^18.0.0 || ^19.0.0

## Quick Start

```tsx
import { MobileProvider, useBreakpoint, useGesture } from '@object-ui/mobile';

function App() {
  return (
    <MobileProvider>
      <ResponsiveApp />
    </MobileProvider>
  );
}

function ResponsiveApp() {
  const { isMobile, isTablet, isDesktop } = useBreakpoint();

  return (
    <div>
      {isMobile && <MobileNav />}
      {isDesktop && <DesktopSidebar />}
      <MainContent />
    </div>
  );
}
```

## API

### MobileProvider

Wraps your application with mobile context:

```tsx
<MobileProvider>
  <App />
</MobileProvider>
```

### useBreakpoint

Hook for detecting the current breakpoint:

```tsx
const { isMobile, isTablet, isDesktop, current } = useBreakpoint();
```

### useResponsive

Hook for responsive values based on screen size:

```tsx
const columns = useResponsive({ mobile: 1, tablet: 2, desktop: 4 });
```

### useGesture / useSpecGesture

Hooks for gesture detection on touch devices:

```tsx
const gestureRef = useGesture({
  onSwipeLeft: () => navigateNext(),
  onSwipeRight: () => navigateBack(),
  onPinch: (scale) => handleZoom(scale),
});

return <div ref={gestureRef}>Swipeable content</div>;
```

### usePullToRefresh

Hook for pull-to-refresh behavior:

```tsx
const { isRefreshing } = usePullToRefresh({
  onRefresh: async () => await fetchData(),
});
```

### useTouchTarget

Hook for ensuring minimum touch target sizes:

```tsx
const { targetProps } = useTouchTarget({ minSize: 44 });
return <button {...targetProps}>Tap me</button>;
```

### ResponsiveContainer

Renders children based on breakpoint:

```tsx
<ResponsiveContainer mobile={<MobileView />} desktop={<DesktopView />} />
```

### PWA Utilities

```tsx
import { generatePWAManifest, registerServiceWorker } from '@object-ui/mobile';

const manifest = generatePWAManifest({ name: 'My App', themeColor: '#000' });
registerServiceWorker({ cacheStrategy: 'network-first' });
```

## License

MIT
