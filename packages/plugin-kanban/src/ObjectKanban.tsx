/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState, useMemo } from 'react';
import type { DataSource } from '@object-ui/types';
import {
  useDataScope,
  useNavigationOverlay,
  useSafeFieldLabel,
  useSafeTranslate,
  extractWriteErrorMessage,
  isPermissionError,
  declaredUserMessage,
} from '@object-ui/react';
import { toast } from '@object-ui/components';
import { createSafeTranslation } from '@object-ui/i18n';
import { RecordDetailDrawer, deriveRecordPageHref } from '@object-ui/plugin-detail';
import {
  extractRecords,
  buildExpandFields,
  getRecordDisplayName,
} from '@object-ui/core';
import { getBadgeColorClasses, getBadgeHexAppearance, getCellRenderer, resolveCellRendererType } from '@object-ui/fields';
import { KanbanRenderer, KANBAN_UNCOLUMNED_ID } from './index';
import { KanbanSchema } from './types';
import {
  collectRequiredWhenPromptFields,
  type RequiredWhenPromptField,
} from './requiredWhenPrompt';
import { RequiredFieldsDialog } from './RequiredFieldsDialog';

/**
 * English fallbacks for the record-detail drawer heading this board opens on
 * card click (objectui#3459, following #3426's shape).
 *
 * The two entries are borrowed from the `detail.*` namespace rather than minted
 * as `kanban.recordDetail`: `NavigationOverlay` and `ListView`/`ObjectGrid`
 * already resolve exactly these, and one heading on one control should not get
 * several translations that can drift apart. They must exist HERE too — a
 * provider-less host (a standalone board, this package's own tests) never
 * reaches the locale packs, and `createSafeTranslation`'s fallback interpolates
 * `{{label}}` from this map.
 *
 * `useSafeTranslate` (the `tt` used elsewhere in this file) cannot serve the
 * labelled branch: its `tt(key, fallback)` signature has no options argument,
 * so `{{label}}` would reach the DOM un-interpolated.
 */
const KANBAN_DEFAULT_TRANSLATIONS: Record<string, string> = {
  'detail.recordDetail': 'Record Detail',
  'detail.recordDetailWithLabel': '{{label}} Detail',
};

/**
 * Rows fetched when the author declared no `limit`.
 *
 * The number is the one this board has always intended: until objectui#4025 the
 * fetch passed `{ options: { $top: 100 } }`, and `options` is not a `QueryParams`
 * key — no adapter in this repo reads `params.options` (`convertQueryParams` in
 * `@object-ui/data-objectstack` and `ApiDataSource` both read `params.$top`), so
 * the cap never reached the wire and a board over a large object fetched whatever
 * the server chose to return, then grouped all of it into lanes client-side. The
 * window is now real, and authorable — same shape `object-timeline` took in
 * objectui#4009 for the identical defect.
 */
export const DEFAULT_KANBAN_LIMIT = 100;

/**
 * Safe wrapper for useObjectTranslation that falls back to the English defaults
 * above when no `I18nProvider` is mounted (standalone board, tests).
 * Delegates to `@object-ui/i18n`'s `createSafeTranslation`.
 */
const useKanbanTranslation = createSafeTranslation(
  KANBAN_DEFAULT_TRANSLATIONS,
  'detail.recordDetail',
);

/**
 * Minimal shape of the object definition this module reads. `objectDef` is
 * fetched via `dataSource.getObjectSchema` and is otherwise untyped here.
 */
interface CardFieldObjectDef {
  /** ADR-0085 semantic role: the object's curated "most important" fields. */
  highlightFields?: unknown;
  /** Declared fields, keyed by field name. */
  fields?: Record<string, unknown>;
}

/**
 * Resolve which record fields render on each kanban card, in priority order:
 *
 *   1. **View-level `cardFields`** — the fields the author configured for the
 *      view (`kanban.columns`, or the view's own columns), forwarded here as
 *      `schema.cardFields`. An explicit choice always wins.
 *   2. **The object's `highlightFields`** — the ADR-0085 semantic role: the
 *      curated "most important fields" list that Grid, List and Detail already
 *      default to. Used when the view declares no card fields, so a board over
 *      an object with no per-view config still surfaces meaningful fields
 *      instead of the legacy semantic-field guesswork. Filtered to fields the
 *      object actually declares so a stale highlight entry can't reference a
 *      dropped field.
 *   3. **`[]`** — neither is available; the caller falls back to its legacy
 *      semantic-field heuristic.
 *
 * Exported for unit testing; kept pure (no React) for that reason.
 */
export function resolveKanbanCardFields(
  cardFields: unknown,
  objectDef: CardFieldObjectDef | null | undefined,
): string[] {
  if (Array.isArray(cardFields) && cardFields.length > 0) {
    return cardFields as string[];
  }
  const highlight = objectDef?.highlightFields;
  if (Array.isArray(highlight)) {
    return (highlight as string[]).filter((n) => Boolean(objectDef?.fields?.[n]));
  }
  return [];
}

/**
 * Props of the `ObjectKanban` React component.
 *
 * Renamed off the bare `ObjectKanbanProps` (objectui#4650): from 17.0.0
 * `@objectstack/spec/ui` owns that name, where it is the AUTHORED props
 * document of the `object-kanban` element — `z.input<typeof
 * ObjectKanbanPropsSchema>`, i.e. serialisable authoring keys only. This is the
 * RENDERER's props: a live `dataSource`, records pre-fetched by a parent, and
 * the host callbacks below, none of which can exist in authored metadata. Two
 * layers under one word, resolved the way this repo already resolved it for
 * `PageHeaderProps` -> `PageHeaderComponentProps` (app-shell) and the
 * `Record*ComponentProps` family in `@object-ui/types`.
 *
 * The barrel keeps `ObjectKanbanProps` as a deprecated alias of this type, so
 * no importer breaks. Tripwire: `__tests__/spec-symbol-4650.test.ts`.
 */
export interface ObjectKanbanComponentProps {
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

export const ObjectKanban: React.FC<ObjectKanbanComponentProps> = ({
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
  const tt = useSafeTranslate();
  // Separate from `tt` because the record-detail heading interpolates a label —
  // see KANBAN_DEFAULT_TRANSLATIONS above.
  const { t } = useKanbanTranslation();
  // When a parent (e.g. ListView) pre-fetches data and passes it via the `data` prop,
  // we must not trigger a second fetch. Detect external data by checking if externalData
  // is an array (undefined when not provided by parent).
  const hasExternalData = Array.isArray(externalData);

  const [fetchedData, setFetchedData] = useState<any[]>([]);
  // The object-definition read and the fact that it has SETTLED are one piece
  // of state, keyed by the object it belongs to (objectui#6271). Two separate
  // states could disagree for one commit — long enough for the record query to
  // fire against the previous object's expand set — and a bare `objectDef`
  // cannot express "settled with nothing", which is a legitimate outcome (an
  // adapter with no `getObjectSchema`, or a read that threw). `key` is compared
  // against the CURRENT object name during render, so switching objects closes
  // the gate in the same commit that changes it, not one commit later.
  const [schemaResolution, setSchemaResolution] = useState<{ key: string; def: any } | null>(null);
  const schemaKey = schema.objectName ?? '';
  /**
   * Has the object definition for THIS object finished resolving? Note what
   * this is NOT: "`objectDef` is truthy". A board whose adapter exposes no
   * `getObjectSchema`, or whose schema read failed, must still get its cards —
   * gating on a truthy definition would leave those boards empty forever.
   */
  const objectDefReady = schemaResolution !== null && schemaResolution.key === schemaKey;
  const objectDef = objectDefReady ? schemaResolution.def : null;
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

  // Fetch object definition for metadata (labels, options).
  //
  // Every exit settles the resolution — success, failure, and "there is nothing
  // to read from" alike — because the record query below WAITS on this
  // (objectui#6271). A path that returned without settling would not merely
  // skip the expansion, it would hold the query open forever.
  useEffect(() => {
    let isMounted = true;
    const key = schema.objectName ?? '';
    const fetchMeta = async () => {
        if (!dataSource || !schema.objectName || typeof dataSource.getObjectSchema !== 'function') {
            // No source for a definition: settle with none, so the board still
            // queries (unexpanded — with no schema there is no expand set to
            // derive, which is the same query this case produced before).
            if (isMounted) setSchemaResolution({ key, def: null });
            return;
        }
        try {
            const def = await dataSource.getObjectSchema(schema.objectName);
            if (isMounted) setSchemaResolution({ key, def });
        } catch (e) {
            console.warn("Failed to fetch object def", e);
            if (isMounted) setSchemaResolution({ key, def: null });
        }
    };
    fetchMeta();
    return () => { isMounted = false; };
  }, [schema.objectName, dataSource]);

  useEffect(() => {
    // Skip internal fetch when data is managed by a parent component
    if (hasExternalData) return;

    // ⭐ objectui#6271 — the object definition GATES this query; it does not
    // refine it afterwards. Before this line the effect ran twice on every
    // mount: once with `objectDef` still unresolved (so `buildExpandFields`
    // saw no fields and the query carried NO `$expand` at all), then again
    // once the definition landed. Measured on the standalone board, the first
    // response never even reached the screen in the regimes that matter — the
    // definition settles first, the effect re-runs, its cleanup flips
    // `isMounted` false, and the unexpanded rows are dropped on arrival. So
    // that round trip bought no earlier paint; it was a query whose answer was
    // thrown away.
    //
    // What the gate costs is one schema resolution before the first query, and
    // that is the measurement this was decided on: a metadata read is one small
    // GET behind the same shared discovery call `find` already awaits, and it
    // is served from `MetadataCache` (5-min TTL, concurrent readers coalesced
    // onto one request) for every reader after the first — 0.01ms, no request.
    // Anything hosting this board (ObjectView, ListView) has already read the
    // same definition through the same adapter, so the gate is free there.
    if (!objectDefReady) return;

    let isMounted = true;
    const fetchData = async () => {
        if (!dataSource || typeof dataSource.find !== 'function' || !schema.objectName) return;
        if (isMounted) setLoading(true);
        try {
            // Auto-inject $expand for lookup/master_detail fields. Reached only
            // with the definition resolved (the gate above), so a board whose
            // object declares lookups queries WITH its expansion the first
            // time — `objectDef` here is `null` only when there was nothing to
            // resolve it from.
            const expand = buildExpandFields(objectDef?.fields);
            // The row cap is a REAL `$top` (objectui#4025). It used to be
            // `{ options: { $top: 100 } }` — `$filter` at the top level where the
            // adapters read it, the cap one level down under a key that is not a
            // `QueryParams` field and that nothing in this repo reads. The number
            // is unchanged; it just reaches the wire now, and `limit` (authored,
            // or a bound view's `pagination.pageSize`) can set it.
            const results = await dataSource.find(schema.objectName, {
                $filter: schema.filter,
                $top: schema.limit ?? DEFAULT_KANBAN_LIMIT,
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
    // `objectDefReady` is what re-runs this effect once the definition lands;
    // `objectDef` stays listed because the body reads it, and with the gate in
    // place the two flip together in one commit — the pre-resolution run now
    // returns above without querying instead of issuing an unexpanded one.
  }, [schema.objectName, dataSource, boundData, schema.data, schema.filter, schema.limit, hasExternalData, objectDefReady, objectDef, refreshKey]);

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
      //
      // ⭐ WHY THIS IS STILL HERE, given objectui#6271 (read this before
      // deleting it). Part of what this suppression used to hide was THIS
      // component's own fetch ordering: the board issued its first query before
      // the object definition resolved, so that query carried no `$expand` and
      // the first paint was rendered from raw lookup ids. That half is gone —
      // the record query is now gated on the definition (see the fetch effect
      // above), so the board's own rows arrive expanded or not at all.
      //
      // The suppression is NOT thereby redundant, because unexpanded rows still
      // reach this function from sources the gate does not sit in front of:
      //
      //   1. `data` handed down by a parent. Measured, not assumed: ObjectView
      //      hosts the board this way and its own query goes out as
      //      `{ $top: 100 }` — it reads the schema through a ref that is still
      //      empty on the one run it makes, so it never injects `$expand` at
      //      all. Every card in that path is built from raw ids.
      //   2. `bind` / inline `schema.data` — author-supplied rows, expanded by
      //      nobody.
      //   3. An adapter or backend that ignores `$expand`, or a single lookup
      //      it cannot resolve (a dangling reference), which comes back as the
      //      bare id inside an otherwise expanded row.
      //
      // So the coupling the two issues share is real and stays recorded: the
      // display heuristic and the fetch ordering move together. What changed is
      // the JUSTIFICATION, not the code — this predicate is now a guard against
      // genuinely unexpanded DATA, no longer a cover for a query this component
      // issued too early.
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
        // Suppression here is a rule about the VALUE, not about the field's
        // declared type: an id-shaped string is gibberish in a card
        // description whatever `objectDef` calls the column — and `objectDef`
        // is optional at this read, so a type gate would suppress nothing on
        // exactly the boards whose schema is thin or absent. The same
        // predicate is applied with no type gate to the incoming
        // `description` further down this function.
        //
        // A relation-typed guard stood immediately above this line
        // (`isExpandableFieldType(def) && isOpaqueId(raw)`, over the same
        // `def = objectDef?.fields?.[key]`) and was unreachable: same `raw`,
        // same predicate, and `OPAQUE_ID_RE` carries no `g`/`y` flag, so
        // repeated `.test()` on it is stateless. Whenever it returned, the
        // line below returned too — computed, branched on, discarded
        // (objectui#6063). Removing it also removed this path's read of
        // `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`; the file's live read
        // of that family is `buildExpandFields` (imported above), which is
        // where objectui#5874's identity pin now sits.
        //
        // Pinned by `__tests__/resolveDisplay.opaqueId-6063.test.tsx`: its
        // first two cases go RED if this is ever re-gated on the field type.
        if (isOpaqueId(raw)) return undefined;
        return raw;
      };

      const descParts: string[] = [];
      // Which fields to render on each card: view-level `cardFields` when the
      // author configured them, otherwise the object's `highlightFields`
      // semantic role (ADR-0085); `[]` drops to the legacy heuristic below.
      // (See `resolveKanbanCardFields` for the full priority contract.)
      const explicitCardFields: string[] = resolveKanbanCardFields(
        (schema as any).cardFields,
        objectDef,
      );
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

      const cardBadges: Array<{
        label: string;
        variant?: any;
        colorClass?: string;
        colorStyle?: React.CSSProperties;
      }> = [];
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
            // Resolved exactly as the grid cell resolves it
            // (`SelectCellRenderer` in `@object-ui/fields`): a declared hex
            // renders as declared (objectui#5141/#5183), a family name keeps
            // going through `getBadgeColorClasses`. `colorStyle` carries the
            // CSS custom properties the hex className reads and travels with
            // the badge to the renderer — the class alone is not a colour.
            const hexBadge = getBadgeHexAppearance(opt?.color);
            const colorClass = hexBadge
              ? hexBadge.className
              : getBadgeColorClasses(opt?.color, raw);
            cardBadges.push({ label: translatedLabel, colorClass, colorStyle: hexBadge?.style });
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
            // Same hex-first resolution as the explicit-card-fields branch
            // above (objectui#5141/#5183); see the comment there for why the
            // style has to travel with the class.
            const hexBadge = getBadgeHexAppearance(option?.color);
            const colorClass = hexBadge
              ? hexBadge.className
              : getBadgeColorClasses(option?.color, v);
            cardBadges.push({ label, colorClass, colorStyle: hexBadge?.style });
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

  // Fallback heading of the record-detail drawer opened on card click, used
  // when the board declares no card-title field (or the record's is empty).
  //
  // Keyed, not string-built (objectui#3459, same shape as #3426). The value is
  // handed to `RecordDetailDrawer`'s required `title` prop, which renders it as
  // the drawer's `SheetTitle`. That heading is `sr-only` — DetailView's own
  // HeaderHighlight draws the visible one — so this string IS the drawer's
  // accessible name to a screen reader, and it was the one English phrase left
  // in an otherwise fully localized zh/ja/de drawer.
  //
  // English output of the first branch is byte-identical (`Tasks Detail`),
  // including with no `I18nProvider` mounted.
  //
  // The second branch is currently UNREACHABLE and deliberately has no test:
  // it fires only when `schema.objectName` is falsy, but the drawer below bails
  // on the very same condition (`if (!objectName || recordId == null) return
  // null`), so nothing renders. It is keyed anyway rather than left as a
  // literal — `'Card Details'` would be an English leak the day that guard
  // relaxes, and reusing `detail.recordDetail` (the key NavigationOverlay
  // itself defaults to) costs nothing and normalizes the stray plural.
  const detailTitle = schema.objectName
    ? t('detail.recordDetailWithLabel', {
        label: schema.objectName.charAt(0).toUpperCase() + schema.objectName.slice(1).replace(/_/g, ' '),
      })
    : t('detail.recordDetail');

  // Persist cross-column drags by writing the new column id back to the
  // record's `groupBy` field. Local state is updated optimistically so the
  // card stays in the target column even after KanbanImpl's reset effect
  // re-syncs from props; the backend update reconciles asynchronously and
  // is reverted with a warning if it fails.
  //
  // `extraValues` carries the fields a `requiredWhen` prompt collected
  // (objectui#4254), so the column value and everything the move makes
  // required go out as ONE PATCH — two writes would leave the record in the
  // state the engine refuses if the second one failed. With no prompt the
  // spread is empty and the body is exactly what it has always been.
  const persistCardMove = React.useCallback(
    async (
      cardId: string,
      fromColumnId: string,
      toColumnId: string,
      extraValues?: Record<string, unknown>,
    ) => {
      const groupBy = schema.groupBy;
      const objectName = schema.objectName;
      if (!groupBy) return;

      // Optimistic local update so the card visibly stays in the new column.
      // Skipped when data is owned by a parent (ListView): `fetchedData` is not
      // what renders on that path (`rawData` prefers `externalData`, :219), and
      // writing it anyway would re-render us and re-bucket from the unchanged
      // `externalData` — snapping the card back before the server has answered.
      // The board's own `boardColumns` already shows the move there. The
      // failure revert below is deliberately NOT gated — see the note on it.
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
          ...(extraValues ?? {}),
        });
        // Land the prompt-collected values locally too, so a card that shows
        // one of them as a `cardFields` cell reflects what was just written
        // instead of waiting for a refetch. Only ever runs on the prompt path
        // — a normal move takes no extra keys and so takes no extra state.
        if (extraValues && !hasExternalData) {
          setFetchedData((prev) =>
            prev.map((r) =>
              String(r.id ?? r._id) === String(cardId) ? { ...r, ...extraValues } : r,
            ),
          );
        }
      } catch (err) {
        console.warn('[ObjectKanban] Failed to persist card move', err);
        // Surface the failure — never silently snap the card back. A row-level
        // security denial (403) is the common case: the user lacks permission
        // to change this record's status. (cloud#864)
        // …unless the AUTHOR opted in. `userMessage` (objectstack#9934) is the
        // producer-side marking: a field set at throw time to say "this text is
        // for the end user". It is a SEPARATE field from `message`, so nothing
        // unmarked can reach here — the substitution below still governs every
        // platform diagnostic and #3821 holds by construction rather than by us
        // guessing what a body contains. Status-agnostic on purpose: 403 is
        // where this was reported (objectui#5210/#5902), not a fence the
        // contract draws — a marked 409 or 400 renders identically.
        toast.error(
          declaredUserMessage(err) ??
            (isPermissionError(err)
              ? tt('errors.unauthorized', 'You are not authorized to perform this action.')
              : extractWriteErrorMessage(err) ?? tt('table.saveFailed', 'Save failed')),
        );
        // Roll the optimistic move back, on BOTH data ownerships (#4138).
        //
        // The optimistic move is the kanban's own local display state, so
        // un-saying it on rejection is the kanban's job regardless of who owns
        // the records. This used to be gated on `!hasExternalData` in the
        // belief that the parent handles the refresh (:147); a parent does
        // re-render on its own refetch, but a REJECTED move changes nothing
        // server-side, so nothing ever triggers that refetch and the card sat
        // in the target column until a manual reload.
        //
        // ONE unconditional call covers both paths, because the card's
        // on-screen position lives in `KanbanImpl`'s `boardColumns` rather than
        // here: its `handleDragEnd` moves the card there before calling us, and
        // an effect re-syncs `boardColumns` from the `columns` prop whenever
        // that prop's identity changes — which every re-render of this
        // component causes (`KanbanRenderer` re-buckets into a fresh array).
        //   - internal data: `fetchedData` is the source of truth, so the map
        //     below both corrects the record and re-renders.
        //   - external data: `fetchedData` is unread and normally empty, but
        //     `Array#map` always allocates, so the fresh identity re-renders us
        //     and the board re-buckets from `externalData` — which the server
        //     never changed. That IS the revert: the card returns to
        //     `fromColumnId`, and an accepted move is left alone because this
        //     runs only on the failure branch.
        setFetchedData((prev) =>
          prev.map((r) =>
            String(r.id ?? r._id) === String(cardId)
              ? { ...r, [groupBy]: fromColumnId }
              : r,
          ),
        );
      }
    },
    [schema.groupBy, schema.objectName, dataSource, hasExternalData, tt],
  );

  /**
   * The drop that is waiting on required fields (objectui#4254). Non-null only
   * while the collect dialog is open; the move has NOT been PATCHed yet.
   */
  const [pendingMove, setPendingMove] = useState<{
    cardId: string;
    fromColumnId: string;
    toColumnId: string;
    fields: RequiredWhenPromptField[];
  } | null>(null);
  const [pendingSubmitting, setPendingSubmitting] = useState(false);

  // Pre-evaluate the target column's `requiredWhen` predicates and collect what
  // the move makes required BEFORE writing anything (objectui#4254). The board
  // used to PATCH the column value alone into a refusal the user could neither
  // read nor act on; with no prompted field this is inert and the move takes
  // the unchanged path below.
  const handleCardMove = React.useCallback(
    async (
      cardId: string,
      fromColumnId: string,
      toColumnId: string,
      _newIndex: number,
    ) => {
      void _newIndex;
      const groupBy = schema.groupBy;
      if (!groupBy || fromColumnId === toColumnId) return;
      // #2792: the "Uncategorized" lane is a display bucket, not a real option.
      // Dragging a card OUT of it into a real column repairs the record's
      // status (handled below); dropping one IN would write the sentinel id as
      // a bogus status, so refuse to persist that direction.
      if (toColumnId === KANBAN_UNCOLUMNED_ID) return;

      // The record as stored, not the card-shaped projection: `effectiveData`
      // overlays a derived `title`/`badges`, and the predicates must see the
      // record's own field values.
      const record = (Array.isArray(rawData) ? rawData : []).find(
        (r) => String(r?.id ?? r?._id) === String(cardId),
      );
      const fields = collectRequiredWhenPromptFields(
        objectDef?.fields,
        record,
        groupBy,
        toColumnId,
      );
      if (fields.length > 0) {
        // No optimistic write and no PATCH: the card sits in its source column
        // behind the modal until the user commits, so Cancel needs no rollback
        // and a refusal that never happens cannot need one either.
        setPendingMove({ cardId, fromColumnId, toColumnId, fields });
        return;
      }

      await persistCardMove(cardId, fromColumnId, toColumnId);
    },
    [schema.groupBy, rawData, objectDef, persistCardMove],
  );

  // Label + localized options for each prompted field, resolved with the same
  // helpers the cards use so the dialog names a field exactly as the board does.
  const pendingFields = useMemo(() => {
    if (!pendingMove) return [];
    const objectKey = objectDef?.name || schema.objectName || '';
    return pendingMove.fields.map((f) => {
      const options = f.def.options;
      const localized =
        objectKey && Array.isArray(options)
          ? translateOptions(objectKey, f.name, options)
          : options;
      const declaredLabel = typeof f.def.label === 'string' ? f.def.label : '';
      return {
        ...f,
        def: { ...f.def, ...(localized ? { options: localized } : {}) },
        label: fieldLabel(objectKey, f.name, declaredLabel || f.name),
      };
    });
  }, [pendingMove, objectDef, schema.objectName, translateOptions, fieldLabel]);

  // Error branch renders only after every hook above has run, so hook order
  // stays stable across renders (no early return before the hooks).
  if (error) {
    return (
      <div className="p-4 border border-destructive/50 rounded bg-destructive/10 text-destructive">
        Error loading kanban data: {error.message}
      </div>
    );
  }

  return (
    <>
      <KanbanRenderer schema={{
        ...effectiveSchema,
        // Card conditional formatting evaluates against the card record, and
        // this fetch expands relations (`buildExpandFields` above) exactly as
        // the grid's does. Handing the renderer the object's field types is
        // what lets a rule comparing a relation see the stored foreign key
        // instead of the expanded record (objectui#3501).
        objectFields: objectDef?.fields,
        onCardClick: (card: any, event?: any) => {
          navigation.handleClick(card, event);
          onCardClick?.(card);
        },
        onCardMove: handleCardMove,
      }} />
      {pendingMove && (
        <RequiredFieldsDialog
          open
          fields={pendingFields}
          submitting={pendingSubmitting}
          onCancel={() => setPendingMove(null)}
          onSubmit={async (values) => {
            const move = pendingMove;
            setPendingSubmitting(true);
            try {
              // ONE combined PATCH: the column value and everything the move
              // made required. `persistCardMove` owns the optimistic write,
              // the toast and the #4138 rollback, so a refusal of the combined
              // body behaves exactly like a refusal of a plain move — and the
              // dialog closes rather than looping on an arbitrary server error.
              await persistCardMove(
                move.cardId,
                move.fromColumnId,
                move.toColumnId,
                values,
              );
            } finally {
              setPendingSubmitting(false);
              setPendingMove(null);
            }
          }}
        />
      )}
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
