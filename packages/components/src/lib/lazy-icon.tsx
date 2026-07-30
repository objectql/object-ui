/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Lazy Lucide icon resolver.
 *
 * Replaces the wildcard `import * as LucideIcons from 'lucide-react'` pattern
 * which forced ~1500 icons (~568 KB raw / 140 KB gz) into the vendor bundle.
 * Each icon is fetched as its own micro-chunk on first use via
 * `lucide-react`'s built-in `DynamicIcon`.
 *
 * The exported `getLazyIcon(name)` API stays synchronous and returns a
 * React component, preserving call-sites that do
 * `const Icon = getLazyIcon(name); <Icon className="..." />`.
 */

import React from 'react';
import { Database } from 'lucide-react';
import { DynamicIcon, iconNames } from 'lucide-react/dynamic.mjs';

/** Convert PascalCase / camelCase / mixed names to kebab-case for DynamicIcon. */
export function toKebabIconName(name: string): string {
  if (name.includes('-')) return name.toLowerCase();
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Lucide ships ~3900 icon names; storing as a Set keeps lookups O(1).
const VALID_ICON_NAMES: Set<string> = new Set(iconNames as string[]);

/** Returns true when `kebab` matches a real Lucide icon. */
function isLucideIcon(kebab: string): boolean {
  return VALID_ICON_NAMES.has(kebab);
}

/**
 * Whether `name` (kebab-case or PascalCase) resolves to a real Lucide icon.
 *
 * Exported because `getLazyIcon` degrades an unknown name to the `Database`
 * icon, which is the right default for a data-shaped schema slot but wrong
 * where a caller has a BETTER fallback of its own — a notification, for
 * instance, would rather show its severity icon than a stray database glyph.
 * Ask first, then choose.
 */
export function isLucideIconName(name?: string): boolean {
  return !!name && isLucideIcon(toKebabIconName(name));
}

const cache = new Map<string, React.ElementType>();

/**
 * Resolve a Lucide icon by name (kebab-case or PascalCase).
 * Returns a memoised React component that lazily loads the SVG on mount.
 * Falls back to the `Database` icon when no `name` is provided or when the
 * requested name is not a valid Lucide icon (server-driven schemas often
 * reference icons from other libraries — we silently degrade rather than
 * letting Lucide log "Name in Lucide DynamicIcon not found").
 */
export function getLazyIcon(name?: string): React.ElementType {
  if (!name) return Database;
  const cached = cache.get(name);
  if (cached) return cached;
  const kebab = toKebabIconName(name);
  if (!isLucideIcon(kebab)) {
    cache.set(name, Database);
    return Database;
  }
  const Wrapped: React.FC<any> = (props) =>
    React.createElement(DynamicIcon as any, { name: kebab, fallback: Database, ...props });
  Wrapped.displayName = `LucideIcon(${name})`;
  cache.set(name, Wrapped);
  return Wrapped;
}

/** Direct ready-to-render component. */
export const LazyIcon: React.FC<{ name?: string } & Record<string, any>> = ({ name, ...rest }) => {
  if (!name) return React.createElement(Database, rest);
  const kebab = toKebabIconName(name);
  if (!isLucideIcon(kebab)) return React.createElement(Database, rest);
  return React.createElement(DynamicIcon as any, {
    name: kebab,
    fallback: Database,
    ...rest,
  });
};
