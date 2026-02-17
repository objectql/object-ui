/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import { generatePWAManifest } from '../pwa';

describe('generatePWAManifest', () => {
  it('generates a manifest with required fields', () => {
    const manifest = generatePWAManifest({
      name: 'My App',
      shortName: 'App',
    });
    expect(manifest.name).toBe('My App');
    expect(manifest.short_name).toBe('App');
  });

  it('applies defaults for optional fields', () => {
    const manifest = generatePWAManifest({
      name: 'My App',
      shortName: 'App',
    });
    expect(manifest.theme_color).toBe('#3b82f6');
    expect(manifest.background_color).toBe('#ffffff');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.orientation).toBe('any');
    expect(manifest.icons).toEqual([]);
  });

  it('uses provided values over defaults', () => {
    const manifest = generatePWAManifest({
      name: 'Custom',
      shortName: 'C',
      description: 'A custom app',
      themeColor: '#ff0000',
      backgroundColor: '#000000',
      display: 'fullscreen',
      startUrl: '/app',
      scope: '/app/',
      orientation: 'portrait',
    });
    expect(manifest.description).toBe('A custom app');
    expect(manifest.theme_color).toBe('#ff0000');
    expect(manifest.background_color).toBe('#000000');
    expect(manifest.display).toBe('fullscreen');
    expect(manifest.start_url).toBe('/app');
    expect(manifest.scope).toBe('/app/');
    expect(manifest.orientation).toBe('portrait');
  });

  it('maps icon configurations', () => {
    const manifest = generatePWAManifest({
      name: 'App',
      shortName: 'A',
      icons: [
        { src: '/icon-192.png', sizes: '192x192' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/webp', purpose: 'maskable' },
      ],
    });
    const icons = manifest.icons as any[];
    expect(icons).toHaveLength(2);
    expect(icons[0]).toEqual({
      src: '/icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    });
    expect(icons[1]).toEqual({
      src: '/icon-512.png',
      sizes: '512x512',
      type: 'image/webp',
      purpose: 'maskable',
    });
  });
});
