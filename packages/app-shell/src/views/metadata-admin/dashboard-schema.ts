// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * dashboard-schema.ts — the SINGLE source of truth for Dashboard authoring
 * metadata, sourced directly from `@objectstack/spec` (the protocol) rather
 * than hand-written field lists. Mirrors {@link ./report-schema.ts}.
 *
 * Why: the Dashboard inspector must render the CORRECT config fields
 * (layout / filters / performance / …) without hardcoding them. The spec
 * already describes this:
 *
 *   • `dashboardForm`   — the canonical authoring FormView: sections for
 *                         basics, layout, widgets, filters and advanced.
 *   • `DashboardSchema` — the zod schema for the whole (flat) Dashboard
 *                         document (name / label / widgets[] / columns /
 *                         gap / dateRange / globalFilters / performance / …).
 *
 * We convert the zod schema to JSONSchema once (memoised) via zod 4's native
 * `z.toJSONSchema`, and feed `{ form, schema }` straight into the existing
 * {@link SchemaForm}. Adding a new dashboard config prop to the spec therefore
 * flows through automatically — zero code changes here.
 */

import { z } from 'zod';
import { DashboardSchema, dashboardForm as specDashboardForm } from '@objectstack/spec/ui';
import type { FormViewSpec } from './SchemaForm';

type JsonSchema = Record<string, any>;

const TO_JSON_OPTS = { io: 'input', unrepresentable: 'any' } as const;

/** Fields the curated inspector owns directly, pruned from the spec form. */
const FORM_FIELDS_OWNED_ELSEWHERE = new Set([
  'widgets', // managed by the dedicated widgets list + per-widget inspector
  'label', // dashboard display name rendered as a dedicated control
  'description', // rendered as a dedicated control
  'name', // record identity — not user-editable here
]);

let _dashboardDocSchema: JsonSchema | undefined;
let _dashboardDocFailed = false;

/** JSONSchema for the whole (flat) Dashboard document. */
export function getDashboardSchema(): JsonSchema | undefined {
  if (_dashboardDocSchema || _dashboardDocFailed) return _dashboardDocSchema;
  try {
    _dashboardDocSchema = z.toJSONSchema(DashboardSchema, TO_JSON_OPTS) as JsonSchema;
  } catch (err) {
    _dashboardDocFailed = true;
    if (typeof console !== 'undefined') {
      console.warn('[dashboard-schema] failed to derive Dashboard JSONSchema from spec', err);
    }
  }
  return _dashboardDocSchema;
}

let _dashboardForm: FormViewSpec | undefined;

/**
 * The canonical authoring FormView, with the fields the curated inspector
 * owns directly (widgets / label / description / name) pruned from every
 * section so they are not double-rendered. Everything else — layout,
 * filters, performance — flows through verbatim from the spec.
 */
export function getDashboardForm(): FormViewSpec | undefined {
  if (_dashboardForm) return _dashboardForm;
  if (!specDashboardForm || typeof specDashboardForm !== 'object') return undefined;
  try {
    const clone = JSON.parse(JSON.stringify(specDashboardForm)) as FormViewSpec;
    for (const section of clone.sections ?? []) {
      section.fields = (section.fields ?? []).filter((f: any) => {
        const name = typeof f === 'string' ? f : f?.field;
        return !FORM_FIELDS_OWNED_ELSEWHERE.has(name);
      });
    }
    // Drop now-empty sections so we don't render bare headers.
    clone.sections = (clone.sections ?? []).filter(
      (s: any) => (s.fields ?? []).length > 0,
    );
    _dashboardForm = clone;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[dashboard-schema] failed to prepare dashboardForm from spec', err);
    }
    return undefined;
  }
  return _dashboardForm;
}
