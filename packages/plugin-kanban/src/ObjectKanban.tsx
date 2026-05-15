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
import { extractRecords, buildExpandFields } from '@object-ui/core';
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
  const { translateOptions } = useSafeFieldLabel();
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

    // Resolve title via, in order:
    //   1. explicit titleField (schema.cardTitle / schema.titleField), if it
    //      yields a non-empty value for the record
    //   2. objectDef.titleFormat — render the full template
    //      (e.g. "{full_name} - {company}")
    //   3. objectDef.NAME_FIELD_KEY
    //   4. Common name-like field fallbacks
    //
    // We always evaluate steps 2-4 when step 1 produced nothing, even when an
    // explicit titleField was supplied. ListView used to default titleField
    // to the literal "name" for objects that didn't have one, which made the
    // explicit-only path resolve to undefined for every record and bypassed
    // the objectDef-derived inference below.
    const TITLE_FALLBACK_FIELDS = [
      'name',
      'full_name',
      'fullName',
      'title',
      'subject',
      'label',
      'display_name',
      'displayName',
    ];

    const rawTitleFormat: any = objectDef?.titleFormat;
    const titleFormat: string | undefined =
      typeof rawTitleFormat === 'string'
        ? rawTitleFormat
        : (rawTitleFormat && typeof rawTitleFormat === 'object' && typeof rawTitleFormat.source === 'string')
          ? rawTitleFormat.source
          : undefined;
    const nameFieldKey: string | undefined = objectDef?.NAME_FIELD_KEY;

    const renderFromTemplate = (template: string, item: Record<string, any>) => {
      // Sentinel for empty placeholders so we can strip orphan separators.
      const EMPTY_TOKEN = '\u0000';
      const SEPARATORS = '[-\\u2013\\u2014|/·,:]';
      let anyResolved = false;
      const raw = template.replace(/\{([^{}]+)\}/g, (_m, key) => {
        const v = item[key.trim()];
        if (v !== undefined && v !== null && v !== '') {
          anyResolved = true;
          return String(v);
        }
        return EMPTY_TOKEN;
      });
      if (!anyResolved) return '';
      const out = raw
        .replace(new RegExp(`\\s*${SEPARATORS}\\s*${EMPTY_TOKEN}`, 'g'), '')
        .replace(new RegExp(`${EMPTY_TOKEN}\\s*${SEPARATORS}\\s*`, 'g'), '')
        .replace(new RegExp(EMPTY_TOKEN, 'g'), '')
        .replace(/\s+/g, ' ')
        .trim();
      return out;
    };

    return rawData.map(item => {
      let resolvedTitle: any = undefined;

      // 1. Explicit titleField
      if (explicitTitleField) {
        resolvedTitle = item[explicitTitleField];
        if (typeof resolvedTitle === 'string') resolvedTitle = resolvedTitle.trim();
      }

      // 2. titleFormat template
      if (!resolvedTitle && titleFormat) {
        const rendered = renderFromTemplate(titleFormat, item);
        if (rendered) resolvedTitle = rendered;
      }

      // 3. NAME_FIELD_KEY
      if (!resolvedTitle && nameFieldKey) {
        const v = item[nameFieldKey];
        if (typeof v === 'string') resolvedTitle = v.trim();
        else if (v) resolvedTitle = v;
      }

      // 4. Common field-name fallbacks
      if (!resolvedTitle) {
        for (const field of TITLE_FALLBACK_FIELDS) {
          const v = item[field];
          const s = typeof v === 'string' ? v.trim() : v;
          if (s) {
            resolvedTitle = s;
            break;
          }
        }
      }

      // Derive a short description and badges from common semantic fields so
      // mobile cards aren't a wall of bare titles. Only emit when not already
      // set by the schema/source.
      const fmtMoney = (n: number) => {
        if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
        if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
        return `$${n}`;
      };
      const descParts: string[] = [];
      const moneyField = ['amount', 'value', 'deal_value', 'expected_value', 'opportunity_value']
        .find(k => typeof item[k] === 'number');
      if (moneyField) descParts.push(fmtMoney(item[moneyField] as number));
      const orgField = ['company', 'company_name', 'account', 'account_name', 'organization']
        .find(k => typeof item[k] === 'string' && item[k]);
      if (orgField && (!resolvedTitle || !String(resolvedTitle).includes(item[orgField]))) {
        descParts.push(item[orgField]);
      }
      const ownerField = ['owner', 'owner_name', 'assignee', 'assignee_name']
        .find(k => typeof item[k] === 'string' && item[k]);
      if (ownerField) descParts.push(`@${item[ownerField]}`);

      const badgeFields = ['priority', 'severity', 'industry', 'rating'];
      const cardBadges: Array<{ label: string; variant?: any }> = [];
      for (const f of badgeFields) {
        const v = item[f];
        if (v != null && v !== '') {
          cardBadges.push({ label: String(v), variant: 'secondary' });
          if (cardBadges.length >= 2) break;
        }
      }

      return {
        ...item,
        // Ensure id exists
        id: item.id || item._id,
        // Map title
        title: resolvedTitle || 'Untitled',
        ...(item.description == null && descParts.length > 0
          ? { description: descParts.join(' · ') }
          : {}),
        ...(!Array.isArray(item.badges) && cardBadges.length > 0
          ? { badges: cardBadges }
          : {}),
      };
    });
  }, [rawData, schema, objectDef]);

  // Generate columns if missing but groupBy is present
  const effectiveColumns = useMemo(() => {
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
             return schema.columns;
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
  const navIsOverlay = navConfig.mode === 'drawer' || navConfig.mode === 'modal' || navConfig.mode === 'split' || navConfig.mode === 'popover';
  const navigation = useNavigationOverlay({
    navigation: navConfig,
    objectName: schema.objectName,
    onRowClick: navIsOverlay ? undefined : (onRowClick ?? onCardClick),
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

  return (
    <>
      <KanbanRenderer schema={{
        ...effectiveSchema,
        onCardClick: (card: any) => {
          navigation.handleClick(card);
          onCardClick?.(card);
        },
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
