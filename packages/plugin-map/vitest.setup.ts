import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock maplibre-gl to avoid "Failed to initialize WebGL" errors
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
    getContainer: vi.fn(() => document.createElement('div')),
    loaded: vi.fn(() => true),
    isStyleLoaded: vi.fn(() => true),
    getCanvas: vi.fn(() => document.createElement('canvas')),
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
    getElement: vi.fn(() => document.createElement('div')),
  }));
  const supported = vi.fn(() => true);

  return {
    default: {
      Map,
      NavigationControl,
      GeolocateControl,
      AttributionControl,
      ScaleControl,
      FullscreenControl,
      Popup,
      Marker,
      supported,
    },
    Map,
    NavigationControl,
    GeolocateControl,
    AttributionControl,
    ScaleControl,
    FullscreenControl,
    Popup,
    Marker,
    supported,
  };
});
