// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * report-schema.ts — the SINGLE source of truth for Report authoring
 * metadata, sourced directly from `@objectstack/spec` (the protocol) rather
 * than hand-written field lists. Mirrors {@link ./view-schema.ts}.
 *
 * Why: the Report inspector must render the CORRECT config fields for EVERY
 * report type (tabular / summary / matrix / joined) without hardcoding them.
 * The spec already describes this:
 *
 *   • `reportForm`   — the canonical authoring FormView: sections for basics,
 *                      columns, groupings, joined blocks, filter & chart, and
 *                      advanced. One section (joined blocks) is type-
 *                      conditional via a `visibleOn` CEL predicate.
 *   • `ReportSchema` — the zod schema for the whole (flat) Report document.
 *
 * We convert the zod schema to JSONSchema once (memoised) via zod 4's native
 * `z.toJSONSchema`, and feed `{ form, schema }` straight into the existing
 * {@link SchemaForm}. Adding a new report type or config prop to the spec
 * therefore flows through automatically — zero code changes here.
 */

import { z } from 'zod';
import { ReportSchema, reportForm as specReportForm } from '@objectstack/spec/ui';
import type { FormViewSpec } from './SchemaForm';

type JsonSchema = Record<string, any>;

const TO_JSON_OPTS = { io: 'input', unrepresentable: 'any' } as const;

/** Fields the curated inspector owns directly, pruned from the spec form. */
const FORM_FIELDS_OWNED_ELSEWHERE = new Set([
  'columns', // managed by the dedicated report-columns list
  'objectName', // object binding rendered as a dedicated control
  'name', // record identity — not user-editable here
]);

let _reportDocSchema: JsonSchema | undefined;
let _reportDocFailed = false;

/** JSONSchema for the whole (flat) Report document. */
export function getReportSchema(): JsonSchema | undefined {
  if (_reportDocSchema || _reportDocFailed) return _reportDocSchema;
  try {
    _reportDocSchema = z.toJSONSchema(ReportSchema, TO_JSON_OPTS) as JsonSchema;
  } catch (err) {
    _reportDocFailed = true;
    if (typeof console !== 'undefined') {
      console.warn('[report-schema] failed to derive Report JSONSchema from spec', err);
    }
  }
  return _reportDocSchema;
}

let _reportForm: FormViewSpec | undefined;

/**
 * The canonical authoring FormView, with the fields the curated inspector
 * owns directly (columns / objectName / name) pruned from every section so
 * they are not double-rendered. Everything else — including the type-
 * conditional joined-blocks section — flows through verbatim from the spec.
 */
export function getReportForm(): FormViewSpec | undefined {
  if (_reportForm) return _reportForm;
  if (!specReportForm || typeof specReportForm !== 'object') return undefined;
  try {
    const clone = JSON.parse(JSON.stringify(specReportForm)) as FormViewSpec;
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
    _reportForm = clone;
  } catch (err) {
    if (typeof console !== 'undefined') {
      console.warn('[report-schema] failed to prepare reportForm from spec', err);
    }
    return undefined;
  }
  return _reportForm;
}
