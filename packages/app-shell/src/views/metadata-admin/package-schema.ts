// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * package-schema.ts — the SINGLE source of truth for package-manifest
 * authoring metadata, sourced directly from `@objectstack/spec/kernel`
 * (`ManifestSchema`) rather than hand-written field lists. Mirrors
 * {@link ./page-schema} / view-schema / report-schema.
 *
 * Why: package create / edit / view used to be THREE hand-rolled forms
 * (CreatePackageDialog, EditPackageDialog, BuilderLanding's inline form) with
 * two DIFFERENT id regexes — a package created via one surface was rejected by
 * another, and neither matched what the server accepts. Rendering the
 * spec-derived form through {@link SchemaForm} gives one field definition and
 * one validation everywhere.
 *
 * `ManifestSchema` carries 25+ fields, most of them authoring-time machine
 * config (`contributes` / `packaging` / `integrity` / `engines` …). A curated
 * FormView surfaces only the human-relevant subset; the rest stay in the
 * schema (so a submitted manifest round-trips) but are hidden from the form.
 *
 * We convert the zod schema to JSONSchema once (memoised) via zod 4's native
 * `z.toJSONSchema` and feed `{ form, schema }` straight into SchemaForm.
 * Adding a manifest field in the spec flows through automatically — zero code
 * changes here.
 */

import { z } from 'zod';
import { ManifestSchema } from '@objectstack/spec/kernel';
import type { FormViewSpec } from './SchemaForm';
import { t } from './i18n';

type JsonSchema = Record<string, any>;

const TO_JSON_OPTS = { io: 'input', unrepresentable: 'any' } as const;

/**
 * The curated fields the package form surfaces, in display order. Everything
 * else on the manifest is machine/authoring config and is hidden from the
 * form (but preserved on save).
 */
export const PACKAGE_FORM_FIELDS = [
  'name',
  'id',
  'version',
  'type',
  'description',
  'namespace',
  'defaultDatasource',
  'scope',
  'dependencies',
] as const;

let _schema: JsonSchema | undefined;
let _schemaFailed = false;

/** JSONSchema for the whole package manifest (memoised, spec-derived). */
export function getPackageSchema(): JsonSchema | undefined {
  if (_schema || _schemaFailed) return _schema;
  try {
    _schema = z.toJSONSchema(ManifestSchema, TO_JSON_OPTS) as JsonSchema;
  } catch (err) {
    _schemaFailed = true;
    if (typeof console !== 'undefined') {
      console.warn('[package-schema] failed to derive manifest JSONSchema from spec', err);
    }
  }
  return _schema;
}

/**
 * Curated authoring FormView for a package manifest.
 *
 * `id` / `type` / `namespace` / `defaultDatasource` / `scope` / `dependencies`
 * are marked `immutable` — editable when CREATING (SchemaForm `createMode`)
 * but locked once the package exists, because the REST `PATCH /packages/:id`
 * only persists `name` / `description` / `version`. `name` / `version` /
 * `description` stay editable in every non-view mode.
 */
export function getPackageForm(locale: string): FormViewSpec {
  return {
    type: 'modal',
    sections: [
      {
        label: t('engine.packages.form.basics', locale),
        columns: 1,
        fields: [
          { field: 'name', label: t('engine.packages.create.name', locale), placeholder: 'Acme CRM' },
          {
            field: 'id',
            label: t('engine.packages.create.id', locale),
            placeholder: 'com.acme.crm',
            immutable: true,
          },
          // Object-name namespace (framework#2694): every object in the package
          // is named `<namespace>_*`. PackageFormDialog auto-derives it from the
          // id on create until the user edits it. Locked once the package exists.
          {
            field: 'namespace',
            label: t('engine.packages.create.namespace', locale),
            placeholder: 'crm',
            immutable: true,
          },
          { field: 'version', label: t('engine.packages.create.version', locale), placeholder: '0.1.0' },
          { field: 'type', label: t('engine.packages.detail.type', locale), immutable: true },
          { field: 'description', label: t('engine.packages.detail.description', locale) },
        ],
      },
      {
        label: t('engine.packages.form.advanced', locale),
        collapsible: true,
        collapsed: true,
        columns: 1,
        fields: [
          {
            field: 'defaultDatasource',
            label: t('engine.packages.form.defaultDatasource', locale),
            immutable: true,
          },
          { field: 'scope', label: t('engine.packages.form.scope', locale), immutable: true },
          { field: 'dependencies', label: t('engine.packages.form.dependencies', locale), immutable: true },
        ],
      },
    ],
  };
}
