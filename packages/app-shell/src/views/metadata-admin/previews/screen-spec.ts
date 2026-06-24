// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * screen-spec — pure helpers that map a flow `screen` node's authored `config`
 * onto the runtime `ScreenSpec` (the contract {@link ScreenView} renders), plus
 * `{var}` interpolation for the title/description. Kept framework-free so
 * {@link ScreenPreview} stays a thin component and these stay unit-testable.
 */

import type { ScreenSpec, ScreenFieldSpec } from '../../ScreenView';

/** Minimal node shape the preview needs (id + authored config). */
export interface ScreenPreviewNode {
  id: string;
  label?: string;
  config?: Record<string, unknown>;
}

/**
 * Interpolate `{var}` references, mirroring the simulator's `{var}` syntax
 * (flow-simulator.ts). Known vars are substituted; unknown refs stay literal so
 * the author still sees the dependency in the design preview.
 */
export function interpolate(text: string | undefined, vars: Record<string, unknown> | undefined): string {
  if (!text) return '';
  if (!vars) return text;
  return text.replace(/\{([^{}]+)\}/g, (m, k) => {
    const v = vars[String(k).trim()];
    return v === undefined || v === null ? m : String(v);
  });
}

/** Coerce the authored `config.fields` rows into runtime `ScreenFieldSpec`s. */
function toScreenFields(raw: unknown): ScreenFieldSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreenFieldSpec[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name) continue;
    out.push({
      name: row.name,
      label: typeof row.label === 'string' ? row.label : undefined,
      type: typeof row.type === 'string' ? row.type : undefined,
      required: row.required === true,
    });
  }
  return out;
}

/**
 * Map a screen node's authored `config` onto the runtime `ScreenSpec` — the
 * same keys the engine's `screen` executor reads (title / description / fields
 * / objectName / mode / defaults / idVariable).
 */
export function buildScreenSpec(node: ScreenPreviewNode): ScreenSpec {
  const c = (node.config && typeof node.config === 'object' ? node.config : {}) as Record<string, unknown>;
  const objectName = typeof c.objectName === 'string' && c.objectName ? c.objectName : undefined;
  const mode = c.mode === 'edit' ? 'edit' : c.mode === 'create' ? 'create' : undefined;
  const defaults =
    c.defaults && typeof c.defaults === 'object' && !Array.isArray(c.defaults)
      ? (c.defaults as Record<string, unknown>)
      : undefined;
  return {
    nodeId: node.id,
    title: typeof c.title === 'string' ? c.title : undefined,
    description: typeof c.description === 'string' ? c.description : undefined,
    fields: toScreenFields(c.fields),
    kind: objectName ? 'object-form' : 'fields',
    objectName,
    mode,
    defaults,
    idVariable: typeof c.idVariable === 'string' ? c.idVariable : undefined,
  };
}
