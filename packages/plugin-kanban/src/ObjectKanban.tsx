/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import { useDataScope, useNavigationOverlay, useSafeFieldLabel } from '@object-ui/react';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import { extractRecords, buildExpandFields, getRecordDisplayName } from '@object-ui/core';
import { getBadgeColorClasses, getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { KanbanRenderer } from './index';
import { KanbanSchema } from './types';

export interface ObjectKanbanProps {
  schema: KanbanSchema;
  dataSource?: DataSource;
  className?: string; // Allow override
  /** Pre-fetched records passed by a parent (e.g. ListView). When provided, skips internal data fetching. */
  data?: any[];
  /** Loading state propagated from a parent. Respected only when `data` is also provided. */
  loading?: boolean;
  onRowClick?: (record: any) => void;
  onCardClick?: (record: any) => void;
}

export const ObjectKanban: React.FC<ObjectKanbanProps> = ({
  schema,
  dataSource,
  className,
  data: externalData,
  loading: externalLoading,
  onRowClick,
  onCardClick,
  ..._props
}) => {
  void _props;
  const { translateOptions, fieldLabel } = useSafeFieldLabel();
  // When a parent (e.g. ListView) pre-fetches data and passes it via the `data` prop,
  // we must not trigger a second fetch. Detect external data by checking if externalData
  // is an array (undefined when not provided by parent).
  const hasExternalData = Array.isArray(externalData);

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  const [objectDef, setObjectDef] = useState<any>(null);
  // loading state
  const [loading, setLoading] = useState(hasExternalData ? (externalLoading ?? false) : false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Resolve bound data if 'bind' property exists
  const boundData = useDataScope(schema.bind);

  // P2: Auto-subscribe to DataSource mutation events (standalone mode only).
  // When rendered as a child of ListView, data is managed externally and this is skipped.
  useEffect(() => {
    if (hasExternalData) return; // Parent handles refresh
    if (!dataSource?.onMutation || !schema.objectName) return;
    const unsub = dataSource.onMutation((event: any) => {
      if (event.resource === schema.objectName) {
        setRefreshKey(k => k + 1);
      }
    });
    return unsub;
  }, [dataSource, schema.objectName, hasExternalData]);

  // Sync external data changes from parent (e.g. ListView re-fetches after filter change)
  useEffect(() => {
    if (hasExternalData && externalLoading !== undefined) {
      setLoading(externalLoading);
    }
  }, [externalLoading, hasExternalData]);

  // Fetch object definition for metadata (labels, options)
  useEffect(() => {
    let isMounted = true;
    const fetchMeta = async () => {
        if (!dataSource || !schema.objectName) return;
        try {
            const def = await dataSource.getObjectSchema(schema.objectName);
            if (isMounted) setObjectDef(def);
        } catch (e) {
            console.warn("Failed to fetch object def", e);
        }
    };
    fetchMeta();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  useEffect(() => {
    // Skip internal fetch when data is managed by a parent component
    if (hasExternalData) return;

    let isMounted = true;
    const fetchData = async () => {
        if (!dataSource || typeof dataSource.find !== 'function' || !schema.objectName) return;
        if (isMounted) setLoading(true);
        try {
            // Auto-inject $expand for lookup/master_detail fields
            const expand = buildExpandFields(objectDef?.fields);
            const results = await dataSource.find(schema.objectName, {
                options: { $top: 100 },
                $filter: schema.filter,
                ...(expand.length > 0 ? { $expand: expand } : {}),
            });
            
            // Handle { value: [] } OData shape or { data: [] } shape or direct array
            const data = extractRecords(results);

            if (isMounted) {
                setFetchedData(data);
            }
        } catch (e) {
            console.error('[ObjectKanban] Fetch error:', e);
            if (isMounted) setError(e as Error);
        } finally {
            if (isMounted) setLoading(false);
        }
    };

    // Trigger fetch if we have an objectName AND verify no inline/bound data overrides it
    if (schema.objectName && !boundData && !schema.data) {
        fetchData();
    }
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, hasExternalData, objectDef, refreshKey]);

  // Determine which data to use: external -> bound -> inline -> fetched
  const rawData = (hasExternalData ? externalData : undefined) || boundData || schema.data || fetchedData;

  // Enhance data with title mapping and ensure IDs
  const effectiveData = useMemo(() => {
    if (!Array.isArray(rawData)) return [];

    // Support cardTitle property from schema (passed by ObjectView)
    // Fallback to legacy titleField for backwards compatibility
    const explicitTitleField: string | undefined =
      schema.cardTitle || (schema as any).titleField;

    // Title is resolved per-item below via:
    //   1. explicit titleField (schema.cardTitle / schema.titleField), if it
    //      yields a non-empty value for the record;
    //   2-4. otherwise the unified `@object-ui/core#getRecordDisplayName`
    //      (ADR-0079): objectDef.titleFormat → objectDef.displayNameField →
    //      type-aware field derivation → `Record #<id>` floor.
    //
    // ListView used to default titleField to the literal "name" for objects
    // that had none, which made the explicit-only path resolve to undefined for
    // every record and bypassed any objectDef-derived inference. The shared
    // resolver removes that footgun.
    // `nameFieldKey` is retained: it still feeds the description-field skip set
    // below so the title field's raw value isn't repeated in the card body.
    const nameFieldKey: string | undefined = objectDef?.NAME_FIELD_KEY;

    return rawData.map(item => {
      let resolvedTitle: any = undefined;

      // 1. Explicit titleField (schema.cardTitle / schema.titleField).
      if (explicitTitleField) {
        resolvedTitle = item[explicitTitleField];
        if (typeof resolvedTitle === 'string') resolvedTitle = resolvedTitle.trim();
      }

      // 2-4. Unified object-level resolver (ADR-0079): titleFormat →
      //   objectDef.displayNameField → type-aware field derivation. Replaces the
      //   old per-view chain (template render → NAME_FIELD_KEY → hard-coded
      //   name list) so a board over an object whose name lives in e.g.
      //   `activity_name` shows the real name instead of "Untitled".
      if (!resolvedTitle) {
        const unified = getRecordDisplayName(objectDef, item);
        const id = item.id ?? item._id;
        const isFloor =
          unified === 'Untitled' ||
          (id !== null && id !== undefined && unified === `Record #${id}`);
        if (!isFloor) resolvedTitle = unified;
      }

      // Derive a short description and badges from common semantic fields so
      // mobile cards aren't a wall of bare titles. Only emit when not already
      // set by the schema/source.
      const fmtMoney = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
        if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
        return `$${n}`;
      };
      // Detect strings that look like opaque foreign-key IDs so we don't dump
      // gibberish into card descriptions when the server didn't expand the lookup.
      const OPAQUE_ID_RE = /^[A-Za-z0-9_-]{12,32}$/;
      const isOpaqueId = (v: unknown): boolean => {
        if (typeof v !== 'string') return false;
        if (!OPAQUE_ID_RE.test(v)) return false;
        const hasUpper = /[A-Z]/.test(v);
        const hasLower = /[a-z]/.test(v);
        const hasDigitOrSep = /[0-9_-]/.test(v);
        return (hasUpper && hasLower) || (hasUpper && hasDigitOrSep) || (hasLower && hasDigitOrSep);
      };
      // Pull a human-readable display string from a field. Prefers expanded
      // record's `.name`, skips raw FK IDs, and skips lookup-typed fields whose
      // value didn't get expanded (so we never show "8UY9zHWBfjYjYor4").
      const resolveDisplay = (key: string): string | undefined => {
        const raw = (item as any)[key];
        if (raw == null || raw === '') return undefined;
        if (typeof raw === 'object') {
          const obj = raw as Record<string, unknown>;
          const candidates = ['name', 'full_name', 'display_name', 'label', 'title', 'username'];
          for (const c of candidates) {
            const v = obj[c];
            if (typeof v === 'string' && v.trim()) return v.trim();
          }
          return undefined;
        }
        if (typeof raw !== 'string') return String(raw);
        const def = objectDef?.fields?.[key];
        const isLookup =
          def?.type === 'lookup' || def?.type === 'master_detail' || def?.type === 'reference';
        if (isLookup && isOpaqueId(raw)) return undefined;
        if (isOpaqueId(raw)) return undefined;
        return raw;
      };

      const descParts: string[] = [];
      // If the view config specifies kanban.columns (passed in as schema.cardFields),
      // render those fields explicitly — they represent what the user wants to see
      // on each card. Otherwise fall back to the legacy semantic-field heuristic.
      const explicitCardFields: string[] = Array.isArray((schema as any).cardFields)
        ? (schema as any).cardFields
        : [];
      // The field used as the card title is implicit (resolved above). Don't
      // repeat its raw value in the description if the user already sees it.
      const titleFieldsToSkip = new Set<string>([
        ...(explicitTitleField ? [explicitTitleField] : []),
        ...(nameFieldKey ? [nameFieldKey] : []),
        'name',
        'full_name',
        'title',
        'subject',
        'display_name',
      ]);

      const cardBadges: Array<{ label: string; variant?: any; colorClass?: string }> = [];
      const cardFieldCells: Array<{ field: string; label?: string; node: React.ReactNode }> = [];

      if (explicitCardFields.length > 0) {
        // Render the user-specified card fields. Picklists with configured
        // colors become Badges (compact, scannable); everything else flows
        // through the unified `@object-ui/fields` cell-renderer pipeline so
        // lookup / user / email / url / phone / boolean / image / formula /
        // currency / date / number fields keep the same semantic styling
        // as the Grid and Gallery views (links, icons, formatted values).
        for (const f of explicitCardFields) {
          if (titleFieldsToSkip.has(f)) continue;
          const def = objectDef?.fields?.[f];
          const raw = (item as any)[f];
          if (raw == null || raw === '') continue;
          const isPicklist =
            def?.type === 'picklist' ||
            def?.type === 'multipicklist' ||
            (Array.isArray(def?.options) && def!.options.length > 0);
          if (isPicklist) {
            const opt = def?.options?.find((o: any) =>
              String(o.value).toLowerCase() === String(raw).toLowerCase()
            );
            const rawLabel = opt?.label || String(raw);
            const objectKey = objectDef?.name || schema.objectName;
            const translatedLabel = objectKey
              ? translateOptions(objectKey, f, [{ value: String(opt?.value ?? raw), label: rawLabel }])[0]?.label
                  ?? rawLabel
              : rawLabel;
            const colorClass = getBadgeColorClasses(opt?.color, raw);
            cardBadges.push({ label: translatedLabel, colorClass });
          } else {
            // Route through the same registry that Grid/Gallery use so
            // every field type renders with its canonical widget.
            const fieldType = resolveCellRendererType(def ?? { type: 'text' });
            const CellRenderer = getCellRenderer(fieldType);
            const fieldForCell: any = def ?? { name: f, type: fieldType };
            const node = (
              <CellRenderer
                value={raw}
                field={fieldForCell}
              />
            );
            cardFieldCells.push({
              field: f,
              label: fieldLabel(objectDef?.name || schema.objectName || '', f, def?.label || f),
              node,
            });
          }
        }
      } else {
        // Legacy semantic-field heuristic (no view config provided).
        const moneyField = ['amount', 'value', 'deal_value', 'expected_value', 'opportunity_value']
          .find(k => typeof item[k] === 'number');
        if (moneyField) descParts.push(fmtMoney(item[moneyField] as number));
        const orgKeys = ['company', 'company_name', 'account', 'account_name', 'organization'];
        let orgDisplay: string | undefined;
        for (const k of orgKeys) {
          const d = resolveDisplay(k);
          if (d) { orgDisplay = d; break; }
        }
        if (orgDisplay && (!resolvedTitle || !String(resolvedTitle).includes(orgDisplay))) {
          descParts.push(orgDisplay);
        }
        const ownerKeys = ['owner', 'owner_name', 'assignee', 'assignee_name'];
        let ownerDisplay: string | undefined;
        for (const k of ownerKeys) {
          const d = resolveDisplay(k);
          if (d) { ownerDisplay = d; break; }
        }
        if (ownerDisplay) descParts.push(`@${ownerDisplay}`);

        const badgeFields = ['priority', 'severity', 'industry', 'rating'];
        for (const f of badgeFields) {
          const v = item[f];
          if (v != null && v !== '') {
            const fieldDef = objectDef?.fields?.[f];
            const option = fieldDef?.options?.find((o: any) =>
              String(o.value).toLowerCase() === String(v).toLowerCase()
            );
            const label = option?.label || String(v);
            const colorClass = getBadgeColorClasses(option?.color, v);
            cardBadges.push({ label, colorClass });
            if (cardBadges.length >= 2) break;
          }
        }
      }

      // Treat raw-ID-shaped description as missing so we synthesize a real one
      // from semantic fields below (avoids "8UY9zHWBfjYjYor4" appearing as subtitle).
      const incomingDesc = (item as any).description;
      const descMissing =
        incomingDesc == null ||
        incomingDesc === '' ||
        (typeof incomingDesc === 'string' && isOpaqueId(incomingDesc));

      // P2-4: keep the original record's `description` field intact so the
      // detail drawer / edit form show the real value (or empty placeholder
      // when null). Synthesized text goes to a separate `cardSubtitle`
      // property that KanbanImpl renders in preference to description.
      const synthesizedSubtitle =
        descMissing && descParts.length > 0 ? descParts.join(' · ') : undefined;

      return {
        ...item,
        // Ensure id exists
        id: item.id || item._id,
        // Map title. When neither the explicit field nor the unified resolver
        // produced a name, fall back to the resolver's floor (`Record #<id>`,
        // or 'Untitled' only for a truly id-less record) — ADR-0079.
        title: resolvedTitle || getRecordDisplayName(objectDef, item),
        ...(synthesizedSubtitle ? { cardSubtitle: synthesizedSubtitle } : {}),
        ...(cardFieldCells.length > 0 ? { cardFieldCells } : {}),
        ...(!Array.isArray(item.badges) && cardBadges.length > 0
          ? { badges: cardBadges }
          : {}),
      };
    });
  }, [rawData, schema, objectDef]);

  // Generate columns if missing but groupBy is present
  const effectiveColumns = useMemo(() => {
    // Localize the column title against the groupBy picklist's option labels
    // so kanban swim-lanes pick up i18n overrides even when the view config
    // provides explicit `columns: [{ id, title }]` instead of leaving the
    // renderer to materialize them from `field.options`. Without this the
    // title flows straight from server-side picklist labels (English) into
    // the DOM regardless of locale.
    const localizeColumn = (col: { id: any; title: string }) => {
      if (!schema.objectName || !schema.groupBy) return col;
      const localized = translateOptions(schema.objectName, schema.groupBy, [
        { value: String(col.id), label: col.title },
      ])[0];
      return localized?.label ? { ...col, title: localized.label } : col;
    };

    // If columns exist, returns them (normalized)
    if (schema.columns && schema.columns.length > 0) {
        // If columns is array of strings, normalize to objects
        if (typeof schema.columns[0] === 'string') {
             // If grouping is active, assume string columns are meant for data display, not lanes
             if (!schema.groupBy) {
                 return (schema.columns as unknown as string[]).map(val => ({
                     id: val,
                     title: val
                 }));
             }
        } else {
             return (schema.columns as Array<{ id: any; title: string }>).map(localizeColumn);
        }
    }

    // Try to get options from metadata
    if (schema.groupBy && objectDef?.fields?.[schema.groupBy]?.options) {
        const rawOptions = objectDef.fields[schema.groupBy].options.map((opt: any) => ({
            value: opt.value,
            label: opt.label,
        }));
        const localized = schema.objectName
          ? translateOptions(schema.objectName, schema.groupBy, rawOptions)
          : rawOptions;
        return localized.map((opt: any) => ({
            id: opt.value,
            title: opt.label,
        }));
    }

    // If no columns, but we have groupBy and data, generate from data
    if (schema.groupBy && effectiveData.length > 0) {
        const groups = new Set(effectiveData.map(item => item[schema.groupBy!]));
        return Array.from(groups).map(g => ({
            id: String(g),
            title: String(g)
        }));
    }

    return [];
  }, [schema.columns, schema.groupBy, schema.objectName, effectiveData, objectDef, translateOptions]);

  // Clone schema to inject data and className
  // Use grouping.fields[0].field as swimlaneField fallback when no explicit swimlaneField
  const effectiveSwimlaneField = schema.swimlaneField
    || (schema.grouping?.fields?.[0]?.field);

  const effectiveSchema = {
      ...schema,
      data: effectiveData,
      columns: effectiveColumns,
      className: className || schema.className,
      ...(effectiveSwimlaneField ? { swimlaneField: effectiveSwimlaneField } : {}),
  };

  const navConfig = (schema as any).navigation ?? { mode: 'drawer', width: 'min(960px, 60vw)' };
  // When this kanban is embedded in an ObjectView, the parent provides
  // `onRowClick`/`onCardClick` and owns the unified record-detail overlay.
  // We must always forward to the parent in that case — otherwise we'd open
  // a second, plugin-local drawer alongside the parent's, creating the
  // "two styles of detail view" inconsistency users complained about.
  const externalClick = onRowClick ?? onCardClick;
  const navIsOverlay = !externalClick && (navConfig.mode === 'drawer' || navConfig.mode === 'modal' || navConfig.mode === 'split' || navConfig.mode === 'popover');
  const navigation = useNavigationOverlay({
    navigation: navConfig,
    objectName: schema.objectName,
    onRowClick: externalClick,
  });

  if (error) {
      return (
        <div className="p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
            Error loading kanban data: {error.message}
        </div>
      );
  }

  // Pass through to the renderer
  const detailTitle = schema.objectName
    ? `${schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1).replace(/_/g, ' ')} Detail`
    : 'Card Details';

  // Persist cross-column drags by writing the new column id back to the
  // record's `groupBy` field. Local state is updated optimistically so the
  // card stays in the target column even after KanbanImpl's reset effect
  // re-syncs from props; the backend update reconciles asynchronously and
  // is reverted with a warning if it fails.
  const handleCardMove = React.useCallback(
    async (
      cardId: string,
      fromColumnId: string,
      toColumnId: string,
      _newIndex: number,
    ) => {
      void _newIndex;
      const groupBy = schema.groupBy;
      const objectName = schema.objectName;
      if (!groupBy || fromColumnId === toColumnId) return;

      // Optimistic local update so the card visibly stays in the new column.
      // Skipped when data is owned by a parent (ListView) — the parent's
      // mutation subscription will refetch and propagate the change.
      if (!hasExternalData) {
        setFetchedData((prev) =>
          prev.map((r) =>
            String(r.id ?? r._id) === String(cardId)
              ? { ...r, [groupBy]: toColumnId }
              : r,
          ),
        );
      }

      if (!objectName || !dataSource?.update) return;
      try {
        await dataSource.update(objectName, String(cardId), {
          [groupBy]: toColumnId,
        });
      } catch (err) {
        console.warn('[ObjectKanban] Failed to persist card move', err);
        if (!hasExternalData) {
          // Revert optimistic update on failure
          setFetchedData((prev) =>
            prev.map((r) =>
              String(r.id ?? r._id) === String(cardId)
                ? { ...r, [groupBy]: fromColumnId }
                : r,
            ),
          );
        }
      }
    },
    [schema.groupBy, schema.objectName, dataSource, hasExternalData],
  );

  return (
    <>
      <KanbanRenderer schema={{
        ...effectiveSchema,
        onCardClick: (card: any, event?: any) => {
          navigation.handleClick(card, event);
          onCardClick?.(card);
        },
        onCardMove: handleCardMove,
      }} />
      {navigation.isOverlay && navigation.isOpen && navigation.selectedRecord && (() => {
        const objectName = schema.objectName;
        const rec = navigation.selectedRecord as Record<string, any>;
        const recordId = rec.id ?? rec._id;
        if (!objectName || recordId == null) return null;
        const titleField = (schema as any).cardTitle ?? (schema as any).titleField;
        const titleText = titleField && rec[titleField]
          ? String(rec[titleField])
          : detailTitle;
        return (
          <RecordDetailDrawer
            open
            onClose={navigation.close}
            title={titleText}
            record={rec}
            objectName={objectName}
            recordId={recordId}
            dataSource={dataSource}
            objectSchema={objectDef as any}
            width={(navigation.width as any) ?? 'min(960px, 60vw)'}
            fullPageHref={deriveRecordPageHref(objectName, recordId) ?? undefined}
            onFieldSave={async (field, value) => {
              if (!dataSource?.update) return;
              await dataSource.update(objectName, String(recordId), { [field]: value });
              setFetchedData((prev) => prev.map((r) =>
                String(r.id ?? r._id) === String(recordId)
                  ? { ...r, [field]: value }
                  : r,
              ));
            }}
            onDelete={async () => {
              if (!dataSource?.delete) return;
              await dataSource.delete(objectName, String(recordId));
              setFetchedData((prev) => prev.filter((r) =>
                String(r.id ?? r._id) !== String(recordId),
              ));
            }}
          />
        );
      })()}
    </>
  );
}
