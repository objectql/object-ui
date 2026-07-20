/**
 * Icon utilities
 *
 * Helpers for resolving Lucide icons by name.
 *
 * Implementation: instead of statically importing every icon (~1500
 * components, ~568 KB raw / 140 KB gz), we wrap lucide-react's built-in
 * `DynamicIcon` so each icon is fetched as its own tiny chunk on first use.
 *
 * The exported `getIcon(name)` API stays synchronous and returns a React
 * component, preserving call sites that do `const Icon = getIcon(name); <Icon />`.
 */

import React from 'react';
import { Database } from 'lucide-react';
import { DynamicIcon, iconNames } from 'lucide-react/dynamic.mjs';

/** Convert PascalCase / camelCase / mixed names to kebab-case for DynamicIcon. */
function toKebab(name: string): string {
  if (name.includes('-')) return name.toLowerCase();
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

// Lucide ships ~3900 icon names; storing as a Set keeps lookups O(1).
const VALID_ICON_NAMES: Set<string> = new Set(iconNames as string[]);

const cache = new Map<string, React.ElementType>();

/**
 * Resolve a Lucide icon by name (kebab-case or PascalCase).
 *
 * Returns a React component that lazy-loads the underlying SVG icon on
 * mount. Falls back to the `Database` icon (statically imported) when no
 * `name` is given, or when the requested name is not a valid Lucide icon
 * — server-driven metadata frequently references icons from other libraries
 * (e.g. `box-open` from Font Awesome), and we silently degrade to the
 * fallback rather than letting Lucide log a console error.
 *
 * The returned component is memoised per `name` so repeated calls with the
 * same name yield the same component reference (stable for React.memo).
 */
export function getIcon(name?: string): React.ElementType {
  if (!name) return Database;
  const cached = cache.get(name);
  if (cached) return cached;

  const kebab = toKebab(name);
  if (!VALID_ICON_NAMES.has(kebab)) {
    cache.set(name, Database);
    return Database;
  }

  const Wrapped: React.FC<any> = (props) =>
    React.createElement(DynamicIcon as any, {
      name: kebab,
      fallback: Database,
      ...props,
    });
  Wrapped.displayName = `LucideIcon(${name})`;
  cache.set(name, Wrapped);
  return Wrapped;
}
