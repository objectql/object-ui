/**
 * Icon utilities
 *
 * Synchronous accessor that returns a lazy-loaded Lucide icon React
 * component.  Wraps lucide-react's `DynamicIcon` so we don't bloat the
 * vendor bundle by statically importing the entire icon namespace.
 */

import React from 'react';
import { Database } from 'lucide-react';
import { DynamicIcon } from 'lucide-react/dynamic';

function toKebab(name: string): string {
  if (name.includes('-')) return name.toLowerCase();
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const cache = new Map<string, React.ElementType>();

/**
 * Resolve a Lucide icon component by name.
 *
 * The result is memoised per name in the module-level `cache`, so call sites
 * get a *stable* component reference across renders — nothing is created during
 * render. `react-hooks/static-components` cannot see through the call, so the
 * JSX sites that render the result carry a targeted disable pointing back here.
 */
export function getIcon(name?: string): React.ElementType {
  if (!name) return Database;
  const cached = cache.get(name);
  if (cached) return cached;
  const kebab = toKebab(name);
  const Wrapped: React.FC<any> = (props) =>
    React.createElement(DynamicIcon as any, { name: kebab, fallback: Database, ...props });
  Wrapped.displayName = `LucideIcon(${name})`;
  cache.set(name, Wrapped);
  return Wrapped;
}
