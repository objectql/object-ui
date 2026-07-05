// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * Nav-item deep-link selection (#2272).
 *
 * The designer's internal selection ids are POSITIONAL (`navigation[2]`,
 * `nav[0].children[1]`) — cheap for canvas/inspector wiring but unstable:
 * they drift on reorder and mean nothing outside one editing session. The
 * EXTERNAL contract is the nav item's spec-required snake_case `id`,
 * carried in the URL as `?sel=nav:<id>`. These helpers translate between
 * the two at the designer boundary; positions never leave component state.
 */

import { APP_NAV_ROOT_KEYS } from './inspectors/AppNavInspector';

/** Search param carrying the designer's selected element. */
export const DESIGNER_SEL_PARAM = 'sel';

/** Parse a `sel` param value; returns the nav item id for `nav:<id>`. */
export function parseNavSelParam(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('nav:')) return null;
  const id = value.slice(4);
  return id.length > 0 ? id : null;
}

export function formatNavSelParam(navId: string): string {
  return `nav:${navId}`;
}

interface NavNode {
  id?: string;
  label?: string;
  title?: string;
  name?: string;
  children?: NavNode[];
  [k: string]: unknown;
}

/**
 * Locate a nav item by its `id` across all accepted root keys, returning
 * the positional selection id the canvas/inspector pair uses
 * (`<rootKey>[i]` / `<rootKey>[i].children[j]`), or null when absent.
 */
export function findNavPositionById(
  draft: Record<string, unknown>,
  navId: string,
): { selectionId: string; label?: string } | null {
  const walk = (nodes: NavNode[], prefix: string): { selectionId: string; label?: string } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node || typeof node !== 'object') continue;
      const pos = `${prefix}[${i}]`;
      if (node.id === navId) {
        const label = node.label ?? node.title ?? node.name;
        return { selectionId: pos, label: typeof label === 'string' ? label : undefined };
      }
      if (Array.isArray(node.children)) {
        const hit = walk(node.children, `${pos}.children`);
        if (hit) return hit;
      }
    }
    return null;
  };
  for (const rootKey of APP_NAV_ROOT_KEYS) {
    const arr = (draft as any)[rootKey];
    if (!Array.isArray(arr)) continue;
    const hit = walk(arr as NavNode[], rootKey);
    if (hit) return hit;
  }
  return null;
}

/**
 * Read the nav item `id` at a positional selection id (the inverse of
 * {@link findNavPositionById}); null when the path is invalid or the node
 * has no id.
 */
export function navIdAtPosition(
  draft: Record<string, unknown>,
  positionalId: string,
): string | null {
  const segs = positionalId.split('.');
  let node: NavNode | undefined;
  for (let s = 0; s < segs.length; s++) {
    const m = /^([a-zA-Z_]\w*)\[(\d+)\]$/.exec(segs[s]);
    if (!m) return null;
    const key = m[1];
    const index = Number(m[2]);
    const arr = s === 0 ? (draft as any)[key] : (node as any)?.[key];
    if (!Array.isArray(arr)) return null;
    node = arr[index];
    if (!node || typeof node !== 'object') return null;
  }
  return typeof node?.id === 'string' && node.id ? node.id : null;
}
