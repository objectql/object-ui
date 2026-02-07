/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { icons, type LucideIcon } from 'lucide-react';

/**
 * Convert a kebab-case icon name to PascalCase (e.g., "arrow-right" -> "ArrowRight").
 */
function toPascalCase(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** Map of renamed icons in lucide-react */
const iconNameMap: Record<string, string> = {
  Home: 'House',
};

/**
 * Resolve a Lucide icon by its kebab-case name.
 * Returns null if not found.
 */
export function resolveIcon(name: string | undefined): LucideIcon | null {
  if (!name) return null;
  const pascalName = toPascalCase(name);
  const mapped = iconNameMap[pascalName] || pascalName;
  return (icons as Record<string, LucideIcon>)[mapped] ?? null;
}
