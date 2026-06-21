// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * useDatasetFields — metadata-driven catalogs for the DatasetDefaultInspector
 * pickers (ADR-0021). Turns the dataset designer's three free-text inputs
 * (base object, included relationships, dimension/measure `field`) into
 * dropdowns of the real object graph, so an author picks instead of recalling
 * exact API names.
 *
 *   • {@link useObjectOptions}        — every object (Base object picker).
 *   • {@link useDatasetFieldCatalog}  — the base object's relationships
 *     (join allowlist) + a flat `field` / `relationship.field` option list,
 *     fetching each included relationship's target object on demand.
 *   • {@link useDatasetUsage}         — reverse lineage: how many reports /
 *     dashboards bind this dataset (shown before a breaking edit).
 *
 * The hooks are defensive (a 404 / transport error resolves to an empty
 * catalog so the inspector falls back to free-text entry) and the heavy
 * normalization is factored into exported pure helpers for unit testing.
 */

import * as React from 'react';
import { useMetadataClient } from '../useMetadata';
import { readFields } from '../previews/object-fields-io';

/* ─────────────── Types ─────────────── */

export interface DatasetObjectOption {
  /** Object API name (snake_case) — what `dataset.object` stores. */
  name: string;
  /** Human label (falls back to the name). */
  label: string;
}

export interface DatasetRelationship {
  /** Relationship field name — what goes in `dataset.include`. */
  name: string;
  /** Human label (falls back to the name). */
  label: string;
  /** Target object the relationship points at (for `rel.field` paths). */
  referenceTo?: string;
}

export interface DatasetFieldOption {
  /** Field path: a base field name or `relationship.field`. */
  value: string;
  /** Human label (falls back to the value). */
  label: string;
  /** Raw framework field type (e.g. 'text', 'currency', 'lookup'). */
  type?: string;
  /** Group heading: the base object label, or `rel → target`. */
  group: string;
}

export interface DatasetFieldCatalog {
  relationships: DatasetRelationship[];
  fieldOptions: DatasetFieldOption[];
  loading: boolean;
}

/* ─────────────── Pure helpers (unit-tested) ─────────────── */

/** Field types that join to another object (so they're valid `include` entries). */
const RELATIONSHIP_TYPES = new Set(['lookup', 'master_detail', 'masterdetail', 'master-detail']);

/** Resolve a string | i18n-object label down to a display string. */
export function resolveLabel(label: unknown, fallback: string): string {
  if (typeof label === 'string' && label) return label;
  if (label && typeof label === 'object') {
    const def = (label as { default?: unknown }).default;
    if (typeof def === 'string' && def) return def;
  }
  return fallback;
}

/** Read a lookup/master_detail field's target object from its raw def. */
export function resolveReferenceTo(def: Record<string, unknown>): string | undefined {
  // Framework lookup/master_detail fields carry the target object in `reference`;
  // older / spec shapes use `reference_to` / `referenceTo` / `reference_to_object`.
  const raw =
    def.reference ?? def.reference_to ?? (def as any).referenceTo ?? (def as any).reference_to_object;
  if (typeof raw === 'string' && raw) return raw;
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  if (raw && typeof raw === 'object') {
    const obj = (raw as { object?: unknown }).object;
    if (typeof obj === 'string' && obj) return obj;
  }
  return undefined;
}

/** Map a framework field type onto a dataset dimension type. */
export function fieldTypeToDimensionType(type: string | undefined): string {
  switch (type) {
    case 'lookup':
    case 'master_detail':
    case 'masterDetail':
    case 'master-detail':
      return 'lookup';
    case 'date':
    case 'datetime':
    case 'time':
      return 'date';
    case 'number':
    case 'currency':
    case 'percent':
    case 'int':
    case 'integer':
    case 'float':
    case 'double':
    case 'autonumber':
      return 'number';
    case 'boolean':
    case 'toggle':
      return 'boolean';
    default:
      return 'string';
  }
}

export interface NormalizedObject {
  label: string;
  fields: Array<{ name: string; label: string; type?: string; def: Record<string, unknown> }>;
  relationships: DatasetRelationship[];
}

/** Normalize a raw object metadata doc into label + fields + relationships. */
export function normalizeObject(doc: Record<string, unknown> | null | undefined, name: string): NormalizedObject {
  if (!doc) return { label: name, fields: [], relationships: [] };
  const label = resolveLabel(doc.label, name);
  const fields = readFields((doc as any).fields).entries.map((e) => ({
    name: e.name,
    label: resolveLabel(e.def.label, e.name),
    type: typeof e.def.type === 'string' ? (e.def.type as string) : undefined,
    def: e.def,
  }));
  const relationships: DatasetRelationship[] = fields
    .filter((f) => f.type && RELATIONSHIP_TYPES.has(f.type.toLowerCase()))
    .map((f) => ({ name: f.name, label: f.label, referenceTo: resolveReferenceTo(f.def) }));
  return { label, fields, relationships };
}

/**
 * Build the flat `field` / `relationship.field` option list from the base
 * object and the included relationships' (already-fetched) target objects.
 */
export function buildFieldOptions(
  base: NormalizedObject,
  include: string[],
  targets: Record<string, NormalizedObject>,
): DatasetFieldOption[] {
  const options: DatasetFieldOption[] = base.fields.map((f) => ({
    value: f.name,
    label: f.label,
    type: f.type,
    group: base.label,
  }));
  for (const rel of include) {
    const relationship = base.relationships.find((r) => r.name === rel);
    const target = relationship?.referenceTo ? targets[relationship.referenceTo] : undefined;
    if (!target) continue;
    const heading = `${relationship!.label} → ${target.label}`;
    for (const f of target.fields) {
      options.push({ value: `${rel}.${f.name}`, label: f.label, type: f.type, group: heading });
    }
  }
  return options;
}

/** Recursively test whether a metadata doc references `datasetName` via a `dataset` key. */
export function referencesDataset(doc: unknown, datasetName: string): boolean {
  if (!doc || typeof doc !== 'object') return false;
  if (Array.isArray(doc)) return doc.some((d) => referencesDataset(d, datasetName));
  const rec = doc as Record<string, unknown>;
  if (typeof rec.dataset === 'string' && rec.dataset === datasetName) return true;
  return Object.values(rec).some((v) => v && typeof v === 'object' && referencesDataset(v, datasetName));
}

/* ─────────────── Hooks ─────────────── */

/** Every object as `{ name, label }`, sorted by label. Fetched once. */
export function useObjectOptions(): { options: DatasetObjectOption[]; loading: boolean } {
  const client = useMetadataClient();
  const [state, setState] = React.useState<{ options: DatasetObjectOption[]; loading: boolean }>({
    options: [],
    loading: true,
  });

  React.useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    client
      .list<Record<string, unknown>>('object')
      .then((docs) => {
        if (cancelled) return;
        const options = (Array.isArray(docs) ? docs : [])
          .map((d) => ({ name: typeof d.name === 'string' ? d.name : '', label: resolveLabel(d.label, typeof d.name === 'string' ? d.name : '') }))
          .filter((o) => !!o.name)
          .sort((a, b) => a.label.localeCompare(b.label));
        setState({ options, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ options: [], loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return state;
}

/**
 * The base object's relationships (join allowlist) + a flat `field` /
 * `relationship.field` option list. Refetches when `object` or the set of
 * included relationships changes.
 */
export function useDatasetFieldCatalog(
  object: string | undefined,
  include: string[],
): DatasetFieldCatalog {
  const client = useMetadataClient();
  const includeKey = include.join(' ');
  const [state, setState] = React.useState<DatasetFieldCatalog>({
    relationships: [],
    fieldOptions: [],
    loading: !!object,
  });

  React.useEffect(() => {
    if (!object) {
      setState({ relationships: [], fieldOptions: [], loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const baseDoc = await client.get<Record<string, unknown>>('object', object);
        if (cancelled) return;
        const base = normalizeObject(baseDoc, object);
        // Resolve which target objects the included relationships point at,
        // then fetch each unique target's fields for `rel.field` options.
        const wantedTargets = new Set<string>();
        for (const rel of includeKey ? includeKey.split(' ') : []) {
          const r = base.relationships.find((x) => x.name === rel);
          if (r?.referenceTo) wantedTargets.add(r.referenceTo);
        }
        const targetEntries = await Promise.all(
          [...wantedTargets].map(async (t) => {
            try {
              const doc = await client.get<Record<string, unknown>>('object', t);
              return [t, normalizeObject(doc, t)] as const;
            } catch {
              return [t, normalizeObject(null, t)] as const;
            }
          }),
        );
        if (cancelled) return;
        const targets: Record<string, NormalizedObject> = Object.fromEntries(targetEntries);
        const includeList = includeKey ? includeKey.split(' ') : [];
        setState({
          relationships: base.relationships,
          fieldOptions: buildFieldOptions(base, includeList, targets),
          loading: false,
        });
      } catch {
        if (!cancelled) setState({ relationships: [], fieldOptions: [], loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // includeKey captures the include array by value; eslint-disable the
    // exhaustive-deps array-identity warning since we key on the joined string.
  }, [client, object, includeKey]);

  return state;
}

export interface DatasetUsage {
  reports: number;
  dashboards: number;
  loading: boolean;
}

/** Reverse lineage: how many reports / dashboards bind this dataset by name. */
export function useDatasetUsage(name: string | undefined): DatasetUsage {
  const client = useMetadataClient();
  const [state, setState] = React.useState<DatasetUsage>({ reports: 0, dashboards: 0, loading: !!name });

  React.useEffect(() => {
    if (!name) {
      setState({ reports: 0, dashboards: 0, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const [reports, dashboards] = await Promise.all([
        client.list<Record<string, unknown>>('report').catch(() => []),
        client.list<Record<string, unknown>>('dashboard').catch(() => []),
      ]);
      if (cancelled) return;
      setState({
        reports: (Array.isArray(reports) ? reports : []).filter((d) => referencesDataset(d, name)).length,
        dashboards: (Array.isArray(dashboards) ? dashboards : []).filter((d) => referencesDataset(d, name)).length,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [client, name]);

  return state;
}
