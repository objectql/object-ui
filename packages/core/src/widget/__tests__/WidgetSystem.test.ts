/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  WidgetRegistry,
  validateWidgetProps,
  applyWidgetDefaults,
} from '../WidgetSystem';
import { Registry } from '../../registry/Registry';
import type { WidgetManifest } from '@object-ui/types';

// ---------------------------------------------------------------------------
// Test manifests
// ---------------------------------------------------------------------------

const mapManifest: WidgetManifest = {
  name: 'custom-map',
  label: 'Map View',
  version: '1.0.0',
  category: 'visualization',
  tags: ['map', 'geo', 'location'],
  implementation: {
    type: 'npm',
    package: '@my-org/map-widget',
  },
  properties: [
    { name: 'center', type: 'object', required: true, label: 'Center' },
    { name: 'zoom', type: 'number', defaultValue: 10, label: 'Zoom Level' },
    { name: 'mapStyle', type: 'enum', enum: ['street', 'satellite', 'terrain'], label: 'Map Style' },
  ],
  events: [
    { name: 'onMarkerClick', label: 'Marker Click', payload: { markerId: 'string' } },
  ],
  lifecycle: {
    onMount: 'initMap',
    onUnmount: 'destroyMap',
  },
  isContainer: false,
  defaultProps: { zoom: 10, mapStyle: 'street' },
};

const chartManifest: WidgetManifest = {
  name: 'custom-chart',
  label: 'Chart Widget',
  category: 'visualization',
  tags: ['chart', 'data'],
  implementation: {
    type: 'npm',
    package: '@my-org/chart-widget',
  },
  properties: [
    { name: 'data', type: 'array', required: true, label: 'Data' },
    { name: 'chartType', type: 'enum', enum: ['bar', 'line', 'pie'], required: true, label: 'Type' },
    { name: 'title', type: 'string', label: 'Title' },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateWidgetProps', () => {
  it('passes when all required props are provided', () => {
    const result = validateWidgetProps(mapManifest, {
      center: { lat: 0, lng: 0 },
      zoom: 5,
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when required prop is missing', () => {
    const result = validateWidgetProps(mapManifest, {
      zoom: 5,
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Property "Center" is required');
  });

  it('validates enum values', () => {
    const result = validateWidgetProps(mapManifest, {
      center: { lat: 0, lng: 0 },
      mapStyle: 'underwater', // invalid
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('must be one of'))).toBe(true);
  });

  it('validates type mismatches', () => {
    const result = validateWidgetProps(mapManifest, {
      center: { lat: 0, lng: 0 },
      zoom: 'ten', // should be number
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('expected type number'))).toBe(true);
  });
});

describe('applyWidgetDefaults', () => {
  it('applies default values from properties', () => {
    const result = applyWidgetDefaults(mapManifest, {
      center: { lat: 0, lng: 0 },
    });
    expect(result.zoom).toBe(10);
    expect(result.center).toEqual({ lat: 0, lng: 0 });
  });

  it('applies manifest-level defaultProps', () => {
    const result = applyWidgetDefaults(mapManifest, {
      center: { lat: 0, lng: 0 },
    });
    expect(result.mapStyle).toBe('street');
  });

  it('does not override provided values', () => {
    const result = applyWidgetDefaults(mapManifest, {
      center: { lat: 1, lng: 1 },
      zoom: 15,
      mapStyle: 'satellite',
    });
    expect(result.zoom).toBe(15);
    expect(result.mapStyle).toBe('satellite');
  });
});

describe('WidgetRegistry', () => {
  it('registers and retrieves manifests', () => {
    const registry = new WidgetRegistry(new Registry());
    registry.registerManifest(mapManifest);
    registry.registerManifest(chartManifest);

    expect(registry.getManifest('custom-map')).toBe(mapManifest);
    expect(registry.getManifest('custom-chart')).toBe(chartManifest);
    expect(registry.getManifest('nonexistent')).toBeUndefined();
  });

  it('registers catalog', () => {
    const registry = new WidgetRegistry(new Registry());
    registry.registerCatalog([mapManifest, chartManifest]);

    expect(registry.getAllManifests()).toHaveLength(2);
  });

  it('filters by category', () => {
    const registry = new WidgetRegistry(new Registry());
    registry.registerCatalog([mapManifest, chartManifest]);

    const viz = registry.getByCategory('visualization');
    expect(viz).toHaveLength(2);
  });

  it('searches manifests', () => {
    const registry = new WidgetRegistry(new Registry());
    registry.registerCatalog([mapManifest, chartManifest]);

    expect(registry.search('map')).toHaveLength(1);
    expect(registry.search('chart')).toHaveLength(1);
    expect(registry.search('geo')).toHaveLength(1); // tag
    expect(registry.search('visualization')).toHaveLength(0); // category not searched in name/label/tags
  });

  it('returns not-registered for unknown widgets', () => {
    const registry = new WidgetRegistry(new Registry());
    expect(registry.getStatus('unknown')).toBe('not-registered');
  });

  it('unregisters a widget', () => {
    const registry = new WidgetRegistry(new Registry());
    registry.registerManifest(mapManifest);
    expect(registry.getManifest('custom-map')).toBeDefined();

    registry.unregister('custom-map');
    expect(registry.getManifest('custom-map')).toBeUndefined();
  });
});
