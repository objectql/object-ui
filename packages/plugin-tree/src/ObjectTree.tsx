/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ObjectTree Component (tree-grid)
 *
 * Renders a self-referencing object as an indented, expand/collapse tree-grid.
 * Flat records are nested via a single-parent pointer field (`parentField`).
 * The label column is indented per depth with a chevron toggle; any additional
 * `fields` render as flat columns alongside it.
 *
 * Unlike Airtable (whose many-to-many links make a tree ambiguous), ObjectStack's
 * `tree` field is a single-parent pointer, so the nesting is unambiguous and the
 * parent field can be auto-detected from the object schema.
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { DataSource, ViewData } from '@object-ui/types';
import {
  useNavigationOverlay,
  useSafeFieldLabel,
  useSettledSchema,
  NON_GRID_ROW_CEILING,
  NON_GRID_ROW_CEILING_TOP,
  applyNonGridRowCeiling,
  NonGridRowCeilingNote,
} from '@object-ui/react';
import { NavigationOverlay, cn } from '@object-ui/components';
import { createSafeTranslation } from '@object-ui/i18n';
import {
  buildExpandFields,
  columnIdentity,
  isExpandableFieldType,
  getRecordDisplayName,
  humanizeLabel,
} from '@object-ui/core';
import { ChevronRight, ChevronDown } from 'lucide-react';

/**
 * English fallback for the record-detail overlay heading this tree opens on row
 * click (objectui#3459, following #3426's shape).
 *
 * Borrowed from the `detail.*` namespace rather than minted as
 * `tree.recordDetail`: `NavigationOverlay` already resolves
 * `detail.recordDetail` for hosts that pass no title, and one heading on one
 * control should not get two translations that can drift apart. The entry must
 * exist HERE too — a provider-less host (a standalone tree, this package's own
 * tests) never reaches the locale packs.
 *
 * It doubles as the `createSafeTranslation` probe key: with a provider mounted
 * it resolves to a real pack value, without one it comes back as the key and
 * the map below supplies the English.
 */
const TREE_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'detail.recordDetail': 'Record Detail',
};

const useTreeTranslation = createSafeTranslation(
  TREE_DEFAULT_TRANSLATIONS,
  'detail.recordDetail',
);

export interface ObjectTreeProps {
  schema: any;
  dataSource?: DataSource;
  className?: string;
  onRowClick?: (record: any) => void;
  /** Inline data (passed by ListView/ObjectView for non-grid views). */
  data?: any[];
  loading?: boolean;
}

interface TreeConfig {
  parentField?: string;
  labelField: string;
  fields: string[];
  defaultExpandedDepth?: number;
}

interface TreeNode {
  id: string;
  record: any;
  depth: number;
  children: TreeNode[];
}

function getDataConfig(schema: any): ViewData | null {
  if (schema.data) return schema.data;
  if (schema.staticData) return { provider: 'value', items: schema.staticData };
  if (schema.objectName) return { provider: 'object', object: schema.objectName };
  return null;
}

/**
 * Normalize a field entry to its string key. Hosts like ListView pass columns
 * as field *objects* (`{ name | fieldName | field, label, … }`), not bare
 * strings — feeding those straight into `.replace()`/record indexing throws
 * ("e.replace is not a function"). Accept both shapes here so the tree is
 * resilient regardless of caller.
 */
function fieldKey(f: any): string | undefined {
  // `key` stays a tail fallback — it is a generic entry key, not ObjectStack
  // metadata identity, so it is not part of `columnIdentity` (#3104).
  return columnIdentity(f) || (f && typeof f === 'object' ? f.key : undefined) || undefined;
}

function getTreeConfig(schema: any): TreeConfig {
  const nested = (schema.tree || schema.filter?.tree || {}) as Partial<TreeConfig>;
  const rawFields = Array.isArray(schema.fields)
    ? schema.fields
    : Array.isArray(nested.fields)
      ? nested.fields
      : [];
  return {
    parentField: fieldKey(schema.parentField ?? nested.parentField),
    labelField:
      fieldKey(schema.labelField ?? nested.labelField ?? schema.titleField) ?? 'name',
    fields: rawFields.map(fieldKey).filter((f: unknown): f is string => !!f),
    defaultExpandedDepth: schema.defaultExpandedDepth ?? nested.defaultExpandedDepth,
  };
}

/**
 * Auto-detect the single-parent pointer field from the object schema:
 * the first field declared as `tree`, or a lookup/master_detail whose
 * reference points back at this same object.
 */
function detectParentField(objectSchema: any, objectName?: string): string | undefined {
  const fields = objectSchema?.fields;
  if (!fields || typeof fields !== 'object') return undefined;
  let firstSelfRef: string | undefined;
  for (const [key, def] of Object.entries<any>(fields)) {
    if (def?.type === 'tree') return key;
    // A third arm, `def?.referenceTo`, was deleted by objectui#6837: no
    // contract declares that spelling — `@objectstack/spec`'s `FieldSchema`
    // refuses it by name with `unrecognized_keys` ("Did you mean `referenceTo`
    // -> `reference`?"), and it is a tombstone in
    // `RETIRED_FIELD_KEY_TOMBSTONES` (objectui#6041), so the designer read door
    // strips it. It was not a redundant fallback but invented tolerance
    // surface. Pinned in `ObjectTree.referenceArms-6837.test.tsx`.
    const ref = def?.reference || def?.reference_to;
    if (
      !firstSelfRef &&
      (def?.type === 'lookup' || def?.type === 'master_detail') &&
      ref &&
      objectName &&
      ref === objectName
    ) {
      firstSelfRef = key;
    }
  }
  return firstSelfRef;
}

/** Resolve a record's id (records may use `id` or `_id`). */
function recordId(record: any): string | undefined {
  const id = record?.id ?? record?._id;
  return id == null ? undefined : String(id);
}

/** Resolve the parent id from a record's parent-pointer value. */
function parentIdOf(record: any, parentField?: string): string | undefined {
  if (!parentField) return undefined;
  const raw = record?.[parentField];
  if (raw == null) return undefined;
  // Expanded lookup → object with id/_id; otherwise the raw scalar is the id.
  if (typeof raw === 'object') {
    const id = raw.id ?? raw._id;
    return id == null ? undefined : String(id);
  }
  return String(raw);
}

/**
 * Build a nested forest from flat records. Records whose parent is missing
 * (or points outside the result set) become roots, so nothing is dropped.
 */
function buildForest(records: any[], parentField?: string): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  const order: string[] = [];

  for (const record of records) {
    const id = recordId(record);
    if (id == null) continue;
    byId.set(id, { id, record, depth: 0, children: [] });
    order.push(id);
  }

  const roots: TreeNode[] = [];
  for (const id of order) {
    const node = byId.get(id)!;
    const pid = parentIdOf(node.record, parentField);
    const parent = pid != null ? byId.get(pid) : undefined;
    if (parent && parent !== node) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Assign depth top-down.
  const assignDepth = (nodes: TreeNode[], depth: number) => {
    for (const n of nodes) {
      n.depth = depth;
      assignDepth(n.children, depth + 1);
    }
  };
  assignDepth(roots, 0);
  return roots;
}

/** Flatten the forest into the rows currently visible given expansion state. */
function flattenVisible(roots: TreeNode[], expanded: Set<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      out.push(n);
      if (n.children.length > 0 && expanded.has(n.id)) {
        walk(n.children);
      }
    }
  };
  walk(roots);
  return out;
}

/** Collect ids that should start expanded, honoring an optional depth cap. */
function initialExpanded(roots: TreeNode[], depth?: number): Set<string> {
  const set = new Set<string>();
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.children.length === 0) continue;
      if (depth == null || n.depth < depth) {
        set.add(n.id);
        walk(n.children);
      }
    }
  };
  walk(roots);
  return set;
}

/**
 * One entry of a field's `options`. The index signature is not incidental — it
 * is what `useSafeFieldLabel().translateOptions` declares, and this alias exists
 * to be assignable to that signature rather than to re-describe it.
 */
interface FieldOption {
  value: string;
  label: string;
  [key: string]: unknown;
}

/** Translates one field's `options` for the session locale. */
type TranslateOptions = (
  objectName: string,
  fieldName: string,
  options: FieldOption[],
) => FieldOption[];

/** What {@link formatCellValue} needs to format one cell of one column. */
interface CellFormatContext {
  /** The object schema's definition for this column, when one was fetched. */
  fieldDef: any;
  /** The column's field key — the i18n option keys are scoped by it. */
  fieldName: string;
  /** The object the tree is rendering; absent for a schema-less inline mount. */
  objectName?: string;
  /** `useSafeFieldLabel().translateOptions` — identity without a provider. */
  translateOptions: TranslateOptions;
}

/**
 * Format one cell the way the flat table formats the same field — objectui#6014.
 *
 * Both branches DELEGATE the decision rather than re-deciding it, so the tree
 * cannot drift from the surfaces it is supposed to agree with:
 *
 *  - **select-family** (any field carrying `options`): the stored value is
 *    resolved to its option label through `translateOptions`, which is the
 *    exact call `ObjectGrid` makes when it builds a column's `fieldMeta`
 *    (`packages/plugin-grid/src/ObjectGrid.tsx`, the `fieldMeta.options =
 *    translateOptions(...)` line), so both tabs read one `fieldOptions.*` i18n
 *    key. Matching is exact-then-case-insensitive and falls back to
 *    `humanizeLabel`, mirroring `SelectCellRenderer` in `@object-ui/fields`
 *    (seed data stores `Referral` against a declared `referral`). Keying the
 *    branch on "has options" rather than on a list of select spellings is
 *    deliberate: `select` / `status` / `multiselect` / `radio` / `checkboxes` /
 *    `tags` all resolve identically, and a copied type list is one more thing
 *    that can fall behind the registry.
 *
 *  - **reference-family**: an expanded record resolves through
 *    `getRecordDisplayName`, THE unified display-name resolver (ADR-0079), and
 *    the family is judged by `isExpandableFieldType` — the SAME predicate that
 *    decided what to put in `$expand` a few lines up, so "what we expanded" and
 *    "what we unwrap as a reference" cannot disagree.
 *
 * A value with no field definition (an untyped column, or a mount that never
 * fetched a schema) keeps the previous conservative unwrap.
 */
function formatCellValue(value: any, ctx?: CellFormatContext): string {
  if (value == null) return '';

  const options: FieldOption[] | null = Array.isArray(ctx?.fieldDef?.options)
    ? (ctx!.fieldDef.options as FieldOption[])
    : null;
  if (options && options.length > 0) {
    const translated = ctx!.objectName
      ? ctx!.translateOptions(ctx!.objectName, ctx!.fieldName, options)
      : options;
    const labelFor = (raw: unknown): string => {
      const exact = translated.find((opt) => opt?.value === raw);
      if (exact) return String(exact.label ?? raw);
      const normalized = String(raw).toLowerCase();
      const insensitive = translated.find(
        (opt) => String(opt?.value).toLowerCase() === normalized,
      );
      if (insensitive) return String(insensitive.label ?? raw);
      return humanizeLabel(String(raw));
    };
    return Array.isArray(value)
      ? value.filter((v) => v != null).map(labelFor).join(', ')
      : labelFor(value);
  }

  if (typeof value === 'object' && isExpandableFieldType(ctx?.fieldDef)) {
    // No schema for the REFERENCED object here, so this lands on ADR-0079's
    // record-key derivation (`name` / `full_name` / `*_name` / …) and, for an
    // expanded record that came back without any name-ish field, its
    // `Record #<id>` floor — the same string every other surface shows.
    return getRecordDisplayName(undefined, value);
  }

  if (typeof value === 'object') {
    return String(value.name ?? value.label ?? value.id ?? value._id ?? '');
  }
  return String(value);
}

export const ObjectTree: React.FC<ObjectTreeProps> = ({
  schema,
  dataSource,
  className,
  onRowClick,
  ...rest
}) => {
  const [records, setRecords] = useState<any[]>([]);
  /**
   * Did the platform row ceiling bite, and how large was the whole filtered
   * result set (objectui#7210)? Carried from the response that knew it —
   * `records.length === NON_GRID_ROW_CEILING` cannot tell a capped result set
   * apart from one that is exactly that size.
   */
  const [rowCeiling, setRowCeiling] = useState<{ truncated: boolean; total?: number }>({
    truncated: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const dataConfig = useMemo(() => getDataConfig(schema), [schema]);

  /**
   * The object THIS render is bound to, as a plain string — so the resolution
   * below re-keys on the OBJECT rather than on `dataConfig`, a `useMemo` over
   * the `schema` PROP object whose identity a host that rebuilds its schema
   * each render changes without changing which object is bound.
   */
  const schemaKey =
    (dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName) ?? '';

  /**
   * The object schema, and whether it has settled FOR `schemaKey` — a single
   * piece of state, from the shared hook ruled in objectui#6482.
   *
   * It feeds FOUR things: parent-field auto-detection, column labels, the
   * `$expand` list built below, and (objectui#6014) the per-field definitions
   * the cell formatter reads to resolve select options and reference values.
   *
   * ## Why the hook, and not the two `useState`s that were here
   *
   * This component used to carry the definition (`objectSchema`) and "has it
   * settled" (`schemaSettled`) as two SEPARATE pieces of state, the second a
   * one-way latch that nothing ever reset. Two independent values cannot
   * express "settled, but for a DIFFERENT object" — so on an object switch the
   * gate below read `schemaSettled === true` left over from the PREVIOUS
   * object's settle, while `objectSchema` still held the previous object's
   * fields, and the query went out as
   * `find(newObject, { $expand: [ …previous object's relation fields… ] })`:
   * rejected or silently ignored depending on the adapter, plus the transient
   * it painted, before a correct second query followed (objectui#6481).
   *
   * `useSettledSchema` holds ONE value, `{ key, def } | null`, and derives
   * readiness during render by comparing the settled key against `schemaKey`.
   * The gate therefore closes in the SAME commit that changes the object
   * rather than one commit later — and "ready for the wrong object" is not
   * merely fixed but unwritable, because there is no second piece of state
   * left to disagree with the first.
   *
   * ## The settle-on-every-exit guarantee, preserved
   *
   * The `finally` that used to live here existed so the two early `return`s
   * (no `dataSource` / no `getObjectSchema`; no object name) and a rejected
   * read all settled too — otherwise the gated record query below waits
   * forever, and a tree whose adapter serves no schema never renders a row.
   * The hook makes that structural rather than incidental: each of those exits
   * settles explicitly with `def: null`, which is a DISTINCT outcome from "not
   * ready yet". Both halves are pinned in
   * `ObjectTree.settledSchemaKeying-6481.test.tsx`.
   *
   * Gate PLACEMENT stays this component's own, per that same ruling: it sits
   * INSIDE the object-provider branch of the record effect, not at the top of
   * it, because the inline/static branches issue no metadata read and must not
   * be made to wait on one.
   */
  const { ready: schemaSettled, def: objectSchema } = useSettledSchema<any>(
    schemaKey,
    dataSource,
  );

  /**
   * The record-fetch effect below used to key on `dataConfig` itself — the
   * whole memoised object identity. `useMemo` carries no semantic guarantee:
   * React is permitted to discard its cache and recompute, and
   * `getDataConfig(schema)` builds a fresh `{ provider, object }` /
   * `{ provider, items }` wrapper object on every call even when `schema`
   * hasn't changed. So a discard (not just a `schema` change) was enough to
   * re-run the effect and refetch, with nothing about the bound object
   * actually different. These are every primitive field the effect actually
   * reads off `dataConfig`; keying on them instead of the container object
   * makes a cache discard a no-op for it, and returns the `useMemo` above to
   * being a pure optimisation rather than a correctness dependency —
   * mirroring `ObjectMap`/`ObjectCalendar`/`ObjectGantt` (objectui#6592).
   *
   * This is the record effect #6592's branch left untouched (objectui#6700):
   * the OTHER dataConfig-identity dependence in this component — the schema
   * resolution effect — was already retired by #6696 in favor of
   * `useSettledSchema`'s own primitive `schemaKey` above, so this closes out
   * the component rather than one effect of two.
   */
  const dataProvider = dataConfig?.provider;
  const dataObjectName = dataConfig?.provider === 'object' ? dataConfig.object : undefined;
  const dataItems = dataConfig?.provider === 'value' ? dataConfig.items : undefined;

  // Fetch records.
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // A live object dataSource takes precedence over any `data` the host
        // passed down: the tree needs the FULL record (esp. the parent-pointer
        // field), but a host like ListView pre-fetches only the view's display
        // columns — which usually omit the parent field and would flatten the
        // tree. Fetching our own records (no column projection) guarantees the
        // parent field is present so the hierarchy resolves.
        if (dataProvider === 'object' && dataSource && typeof dataSource.find === 'function') {
          // Wait for the schema before querying. `$expand` is DERIVED from it,
          // so firing early guaranteed one query whose lookup columns came back
          // as bare ids — the user saw those raw ids painted, then replaced a
          // moment later once the real query landed. `loading` stays true here
          // so the tree shows its spinner instead of a wrong first answer, and
          // this effect re-runs the moment the latch flips.
          if (!schemaSettled) return;
          const expand = buildExpandFields(objectSchema?.fields);
          // `dataObjectName` is required on the 'object' variant of the
          // discriminated union — same narrowing the pre-refactor
          // `dataConfig.object` read carried.
          const result = await dataSource.find(dataObjectName as string, {
            $filter: schema.filter,
            // The platform ceiling (objectui#7210, ruling a′). A tree still
            // fetches the whole FILTERED set — a hierarchy assembled from a
            // page loses every child whose parent fell outside it, which is
            // why paging this was rejected — but the fetch now stops at a
            // number. This is also the view the ceiling's VALUE was measured
            // on: it materialises ~5.2 DOM elements per record with no
            // virtualisation, so it is the binding one of the four.
            // ⛔ Not authorable: no view key reaches this `$top`.
            $top: NON_GRID_ROW_CEILING_TOP,
            ...(expand.length > 0 ? { $expand: expand } : {}),
          });
          const capped = applyNonGridRowCeiling(result);
          if (!cancelled) {
            setRecords(capped.rows);
            setRowCeiling({ truncated: capped.truncated, total: capped.total });
            setLoading(false);
          }
          return;
        }

        // Otherwise fall back to inline/static data (tests, value provider).
        const passed = (rest as any).data ?? (schema as any).data;
        if (Array.isArray(passed)) {
          if (!cancelled) {
            setRecords(passed);
            setRowCeiling({ truncated: false });
            setLoading(false);
          }
          return;
        }

        if (dataProvider === 'value') {
          if (!cancelled) {
            setRecords((dataItems as any[]) ?? []);
            setRowCeiling({ truncated: false });
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setRecords([]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [dataProvider, dataObjectName, dataItems, dataSource, schema.filter, objectSchema, schemaSettled, (rest as any).data]);

  const config = useMemo(() => getTreeConfig(schema), [schema]);
  const parentField = useMemo(
    () => config.parentField ?? detectParentField(objectSchema, schema.objectName),
    [config.parentField, objectSchema, schema.objectName],
  );

  const roots = useMemo(
    () => buildForest(records, parentField),
    [records, parentField],
  );

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Re-seed expansion whenever the tree shape changes.
  useEffect(() => {
    setExpanded(initialExpanded(roots, config.defaultExpandedDepth));
  }, [roots, config.defaultExpandedDepth]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const visibleRows = useMemo(
    () => flattenVisible(roots, expanded),
    [roots, expanded],
  );

  // Column labels: i18n convention key (`objects.{obj}.fields.{field}.label`)
  // first, then the object schema's authored label, then a humanized field key.
  const i18n = useSafeFieldLabel();
  const headerObjectName: string | undefined =
    (dataConfig?.provider === 'object' ? (dataConfig as any).object : undefined) ?? schema.objectName;
  const fieldLabel = (field: string): string => {
    const def = objectSchema?.fields?.[field];
    const fallback =
      def?.label || field.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    return headerObjectName ? i18n.fieldLabel(headerObjectName, field, fallback) : fallback;
  };

  /**
   * Everything {@link formatCellValue} needs for one column. Built per cell
   * from the SAME `objectSchema.fields` map the header labels read, so a column
   * cannot be labelled from the schema and then formatted without it.
   */
  const cellContext = (field: string): CellFormatContext => ({
    fieldDef: objectSchema?.fields?.[field],
    fieldName: field,
    objectName: headerObjectName,
    translateOptions: i18n.translateOptions,
  });

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick,
  });

  // Heading of the record-detail overlay rendered at the bottom of this file.
  // Must stay above the conditional returns below — rules-of-hooks.
  const { t } = useTreeTranslation();

  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-40 text-destructive', className)}>
        <p>Failed to load tree: {error.message}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-40 text-muted-foreground', className)}>
        <p>Loading…</p>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className={cn('flex items-center justify-center h-40 text-muted-foreground', className)}>
        <p>No records</p>
      </div>
    );
  }

  return (
    <div className={cn('w-full overflow-auto', className)} data-testid="object-tree">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium">{fieldLabel(config.labelField)}</th>
            {config.fields
              .filter((f) => f !== config.labelField)
              .map((f) => (
                <th key={f} className="px-3 py-2 font-medium">
                  {fieldLabel(f)}
                </th>
              ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((node) => {
            const hasChildren = node.children.length > 0;
            const isOpen = expanded.has(node.id);
            return (
              <tr
                key={node.id}
                className="border-b hover:bg-accent/50 cursor-pointer"
                data-testid="object-tree-row"
                data-depth={node.depth}
                onClick={(e) => navigation.handleClick(node.record, e)}
              >
                <td className="px-3 py-2">
                  <div
                    className="flex items-center gap-1"
                    style={{ paddingLeft: `${node.depth * 20}px` }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        aria-label={isOpen ? 'Collapse' : 'Expand'}
                        className="flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggle(node.id);
                        }}
                      >
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="inline-block h-5 w-5" />
                    )}
                    <span className="truncate">
                      {formatCellValue(node.record[config.labelField], cellContext(config.labelField)) || '—'}
                    </span>
                  </div>
                </td>
                {config.fields
                  .filter((f) => f !== config.labelField)
                  .map((f) => (
                    <td key={f} className="px-3 py-2 text-muted-foreground">
                      {formatCellValue(node.record[f], cellContext(f))}
                    </td>
                  ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* objectui#7210 — a hierarchy drawn from the first N rows of a larger
          result set is not a subtree of the real one: every node whose parent
          fell past the cut is reparented to a root. Nothing in the rendering
          says so, which is why the note does. Placement follows
          objectui#7148's chart footnote. */}
      <NonGridRowCeilingNote
        drawn={NON_GRID_ROW_CEILING}
        total={rowCeiling.total}
        truncated={rowCeiling.truncated}
      />

      {navigation.isOverlay && (
        /* Keyed, not a bare literal (objectui#3459). This value is handed to
           `NavigationOverlay`'s `title` prop, so the overlay's own
           `detail.recordDetail` default never applies here — whatever this
           resolves to IS the visible heading of the drawer/modal/split/popover.
           Reusing that very key rather than minting a twin keeps one control on
           one translation. Visible English changes `Record Details` →
           `Record Detail` (the singular the whole `detail.*` family already
           spells); nothing in `e2e/` or the unit suites addressed the plural. */
        <NavigationOverlay {...navigation} title={t('detail.recordDetail')}>
          {(record) => (
            <div className="space-y-3">
              {Object.entries(record).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm">{formatCellValue(value, cellContext(key)) || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </NavigationOverlay>
      )}
    </div>
  );
};

export default ObjectTree;
