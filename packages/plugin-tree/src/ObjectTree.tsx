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
import { useNavigationOverlay, useSafeFieldLabel } from '@object-ui/react';
import { NavigationOverlay, cn } from '@object-ui/components';
import { extractRecords, buildExpandFields } from '@object-ui/core';
import { ChevronRight, ChevronDown } from 'lucide-react';

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
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') return f.name || f.fieldName || f.field || f.key;
  return undefined;
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
    const ref = def?.reference || def?.reference_to || def?.referenceTo;
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

function formatValue(value: any): string {
  if (value == null) return '';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [objectSchema, setObjectSchema] = useState<any>(null);

  const dataConfig = useMemo(() => getDataConfig(schema), [schema]);
  const hasInlineData =
    Array.isArray((rest as any).data) ||
    Array.isArray((schema as any).data) ||
    dataConfig?.provider === 'value';

  // Fetch object schema (for parent-field auto-detection + column labels).
  useEffect(() => {
    let cancelled = false;
    const fetchSchema = async () => {
      try {
        if (!dataSource || typeof dataSource.getObjectSchema !== 'function') return;
        const objectName =
          dataConfig?.provider === 'object' ? dataConfig.object : schema.objectName;
        if (!objectName) return;
        const result = await dataSource.getObjectSchema(objectName);
        if (!cancelled) setObjectSchema(result);
      } catch (err) {
        console.error('[ObjectTree] Failed to fetch object schema:', err);
      }
    };
    if (!hasInlineData) fetchSchema();
    return () => {
      cancelled = true;
    };
  }, [schema.objectName, dataSource, dataConfig, hasInlineData]);

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
        if (dataConfig?.provider === 'object' && dataSource && typeof dataSource.find === 'function') {
          const expand = buildExpandFields(objectSchema?.fields);
          const result = await dataSource.find(dataConfig.object, {
            $filter: schema.filter,
            ...(expand.length > 0 ? { $expand: expand } : {}),
          });
          if (!cancelled) {
            setRecords(extractRecords(result));
            setLoading(false);
          }
          return;
        }

        // Otherwise fall back to inline/static data (tests, value provider).
        const passed = (rest as any).data ?? (schema as any).data;
        if (Array.isArray(passed)) {
          if (!cancelled) {
            setRecords(passed);
            setLoading(false);
          }
          return;
        }

        if (dataConfig?.provider === 'value') {
          if (!cancelled) {
            setRecords((dataConfig.items as any[]) ?? []);
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
  }, [dataConfig, dataSource, schema.filter, objectSchema, (rest as any).data]);

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

  const navigation = useNavigationOverlay({
    navigation: (schema as any).navigation,
    objectName: schema.objectName,
    onRowClick,
  });

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
                      {formatValue(node.record[config.labelField]) || '—'}
                    </span>
                  </div>
                </td>
                {config.fields
                  .filter((f) => f !== config.labelField)
                  .map((f) => (
                    <td key={f} className="px-3 py-2 text-muted-foreground">
                      {formatValue(node.record[f])}
                    </td>
                  ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {navigation.isOverlay && (
        <NavigationOverlay {...navigation} title="Record Details">
          {(record) => (
            <div className="space-y-3">
              {Object.entries(record).map(([key, value]) => (
                <div key={key} className="flex flex-col">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {key.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm">{formatValue(value) || '—'}</span>
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
