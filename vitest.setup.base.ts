/**
 * ObjectUI — Base test setup
 *
 * Lightweight polyfills that every test (unit + ui) needs. No heavy package
 * imports, no ComponentRegistry registrations — this file must stay cheap so
 * that pure-logic unit tests running in the `node` environment pay minimal
 * startup cost. Heavy DOM + component plumbing lives in `vitest.setup.dom.tsx`.
 */

import { vi } from 'vitest';

// Polyfill ResizeObserver (Radix UI / Shadcn components reference it even in
// node-env unit tests that import components transitively).
if (typeof (globalThis as any).ResizeObserver === 'undefined') {
  (globalThis as any).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Node 22+/25 ships a stubbed native `localStorage` / `sessionStorage` that
// needs `--localstorage-file=<path>` to be functional. Without the flag,
// `clear()` and `removeItem()` are missing, which breaks tests relying on a
// working Storage. Replace with an in-memory Storage for deterministic behavior
// across Node versions.
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  } as Storage;
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
  const existing = (globalThis as any)[name];
  if (!existing || typeof existing.clear !== 'function' || typeof existing.removeItem !== 'function') {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: createMemoryStorage(),
    });
  }
}

// Mock maplibre-gl globally to avoid "Failed to initialize WebGL" errors in any
// test that imports a map-related package transitively.
vi.mock('maplibre-gl', () => {
  const Map = vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    remove: vi.fn(),
    addControl: vi.fn(),
    resize: vi.fn(),
    flyTo: vi.fn(),
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    getContainer: vi.fn(() => (typeof document !== 'undefined' ? document.createElement('div') : {})),
    loaded: vi.fn(() => true),
    isStyleLoaded: vi.fn(() => true),
    getCanvas: vi.fn(() => (typeof document !== 'undefined' ? document.createElement('canvas') : {})),
    setStyle: vi.fn(),
    setCenter: vi.fn(),
    setZoom: vi.fn(),
    getCenter: vi.fn(() => ({ lng: 0, lat: 0 })),
    getZoom: vi.fn(() => 0),
    addSource: vi.fn(),
    removeSource: vi.fn(),
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    setLayoutProperty: vi.fn(),
    setPaintProperty: vi.fn(),
    setFilter: vi.fn(),
    queryRenderedFeatures: vi.fn(() => []),
  }));

  const NavigationControl = vi.fn();
  const GeolocateControl = vi.fn();
  const AttributionControl = vi.fn();
  const ScaleControl = vi.fn();
  const FullscreenControl = vi.fn();
  const Popup = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    setHTML: vi.fn().mockReturnThis(),
    setText: vi.fn().mockReturnThis(),
    setDOMContent: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  }));
  const Marker = vi.fn(() => ({
    setLngLat: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
    setPopup: vi.fn().mockReturnThis(),
    getElement: vi.fn(() => (typeof document !== 'undefined' ? document.createElement('div') : {})),
  }));
  const supported = vi.fn(() => true);

  return {
    default: {
      Map, NavigationControl, GeolocateControl, AttributionControl,
      ScaleControl, FullscreenControl, Popup, Marker, supported,
    },
    Map, NavigationControl, GeolocateControl, AttributionControl,
    ScaleControl, FullscreenControl, Popup, Marker, supported,
  };
});
