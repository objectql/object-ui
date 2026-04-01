/**
 * Icon utilities
 *
 * Helpers for resolving Lucide icons by name.
 */

import * as LucideIcons from 'lucide-react';
import { Database } from 'lucide-react';

/**
 * Resolve a Lucide icon by name (kebab-case or PascalCase)
 * Falls back to Database icon if not found
 */
export function getIcon(name?: string): React.ElementType {
  if (!name) return Database;
  if ((LucideIcons as any)[name]) return (LucideIcons as any)[name];
  const pascal = name
    .split('-')
    .map(p => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  if ((LucideIcons as any)[pascal]) return (LucideIcons as any)[pascal];
  return Database;
}
