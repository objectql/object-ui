// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * screen-spec — pure helpers that map a flow `screen` node's authored `config`
 * onto the runtime `ScreenSpec` (the contract {@link ScreenView} renders), plus
 * `{var}` interpolation for the title/description and `visibleWhen` field
 * gating. Kept framework-free so {@link ScreenPreview} stays a thin component
 * and these stay unit-testable.
 */

import type { ScreenSpec, ScreenFieldSpec } from '../../ScreenView';
import { evalCondition } from './simulator/flow-sim-validate';

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

/**
 * A field's `visibleWhen` gate, evaluated against the current variables using
 * the SAME evaluator the simulator uses for edge conditions (so the preview
 * agrees with the simulator). Real metadata mixes `{var}` and bare-var styles
 * (e.g. `{createOpportunity} == true`, `stage == "review"`), so brace
 * placeholders are normalised to bare identifiers first.
 *
 * Fail-OPEN: a missing condition, an unparseable one, or one that references a
 * not-yet-set variable (the inspector has no run state) keeps the field
 * visible — the design preview never hides a configured field just because it
 * lacks the data to decide. With live run state (the simulator) it gates
 * faithfully: `createOpportunity == false` hides the field.
 */
export function isFieldVisibleWhen(visibleWhen: unknown, variables: Record<string, unknown> | undefined): boolean {
  if (typeof visibleWhen !== 'string' || !visibleWhen.trim()) return true;
  if (!variables) return true;
  const normalized = visibleWhen.replace(/\{([\w.]+)\}/g, '$1');
  const { result, error } = evalCondition(normalized, variables);
  return error ? true : result;
}

/**
 * Coerce the authored `config.fields` rows into runtime `ScreenFieldSpec`s,
 * dropping any whose `visibleWhen` evaluates false against `variables` — exactly
 * what the runtime `screen` executor emits (it filters server-side before
 * sending the ScreenSpec).
 */
function toScreenFields(raw: unknown, variables: Record<string, unknown> | undefined): ScreenFieldSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: ScreenFieldSpec[] = [];
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name) continue;
    if (!isFieldVisibleWhen(row.visibleWhen, variables)) continue;
    out.push({
      name: row.name,
      label: typeof row.label === 'string' ? row.label : undefined,
      type: typeof row.type === 'string' ? row.type : undefined,
      required: row.required === true,
    });
  }
  return out;
}

/** Count of authored field rows hidden by their `visibleWhen` against `variables`. */
export function hiddenFieldCount(node: ScreenPreviewNode, variables: Record<string, unknown> | undefined): number {
  const raw = (node.config as Record<string, unknown> | undefined)?.fields;
  if (!Array.isArray(raw)) return 0;
  let hidden = 0;
  for (const f of raw) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    if (typeof row.name !== 'string' || !row.name) continue;
    if (!isFieldVisibleWhen(row.visibleWhen, variables)) hidden++;
  }
  return hidden;
}

/**
 * Map a screen node's authored `config` onto the runtime `ScreenSpec` — the
 * same keys the engine's `screen` executor reads (title / description / fields
 * / objectName / mode / defaults / idVariable). `fields` are gated by their
 * `visibleWhen` against `variables` (omit `variables` to keep every field).
 */
export function buildScreenSpec(node: ScreenPreviewNode, variables?: Record<string, unknown>): ScreenSpec {
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
    fields: toScreenFields(c.fields, variables),
    kind: objectName ? 'object-form' : 'fields',
    objectName,
    mode,
    defaults,
    idVariable: typeof c.idVariable === 'string' ? c.idVariable : undefined,
  };
}
