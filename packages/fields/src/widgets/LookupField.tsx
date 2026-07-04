import React, { useState, useEffect, useCallback, useRef, useContext, useMemo } from 'react';
import { cn,
  Button,
  Input,
  Badge,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Popover,
  PopoverTrigger,
  PopoverContent, EmptyValue } from '@object-ui/components';
import { Search, X, Loader2, AlertCircle, Plus, TableProperties } from 'lucide-react';
import { FieldWidgetProps } from './types';
import type { DataSource, QueryParams, LookupColumnDef } from '@object-ui/types';
import { RecordPickerDialog, lookupFiltersToRecord } from './RecordPickerDialog';
import type { RecordPickerFilterColumn } from './RecordPickerDialog';
import { PeoplePicker } from './PeoplePicker';
import { useRecordQuery } from './useRecordQuery';
import { deriveLookupColumns } from './deriveLookupColumns';
import { getRecordDisplayName } from '@object-ui/core';
import { getRecentLookupIds, pushRecentLookupId } from './recentLookups';
import { getPersonInitials } from './personDisplay';
import { getCellRendererResolver } from './_cell-renderer-bridge';
import { SchemaRendererContext as ImportedSchemaRendererContext, useAction, useHasActionProvider } from '@object-ui/react';
import { useFieldTranslation } from './useFieldTranslation';

export interface LookupOption {
  value: string | number;
  label: string;
  description?: string;
  [key: string]: any;
}

/** Page size for the quick-select popover typeahead */
const LOOKUP_PAGE_SIZE = 50;

/**
 * SchemaRendererContext is created by @object-ui/react.
 * Using a static import to be compatible with Next.js Turbopack SSR.
 */
const SchemaRendererContext: React.Context<any> = ImportedSchemaRendererContext;

/**
 * A relation whose picker should offer inline "create the referenced record" by
 * default. Inline quick-create is a STANDARD capability so a freshly-built app
 * isn't a dead end (an empty required picker → you can create the FIRST related
 * record right here). Platform/system objects are excluded: the user directory
 * (`sys_user` and its bare `user`/`users` aliases) and everything under the
 * `sys_`/`cloud_`/`ai_` namespaces are pre-populated plumbing you must not create
 * from a field picker. A user-authored business entity (customer, pet, book, …)
 * never matches, so it gets the capability.
 */
const SYSTEM_REFERENCE_RX = /^(sys_|cloud_|ai_)/;
const USER_DIRECTORY_REFS = new Set(['user', 'users']);
function isUserFacingReference(reference: string | undefined): boolean {
  return !!reference && !SYSTEM_REFERENCE_RX.test(reference) && !USER_DIRECTORY_REFS.has(reference);
}

/**
 * Render a record title from a `titleFormat` template (e.g. `{full_name}` or
 * `{case_number} - {subject}`). When a templated key resolves to an empty
 * value, the surrounding separator (`-/|·,:` plus em/en dashes) is stripped
 * so we never produce orphan glyphs like `" - foo"`.
 *
 * Mirrors the implementation in `@object-ui/plugin-detail`'s
 * `resolveDisplayTitle` and `@object-ui/plugin-calendar`'s event-title
 * renderer so labels stay consistent across the product.
 */
function formatRecordTitle(record: any, titleFormat: string): string | null {
  if (!record || typeof record !== 'object' || !titleFormat) return null;
  const EMPTY = '\u0000';
  const SEP = '[-\\u2013\\u2014|/·,:]';
  let any = false;
  const raw = titleFormat.replace(/\{([^{}]+)\}/g, (_m, key) => {
    const v = (record as any)[key.trim()];
    if (v !== null && v !== undefined && v !== '') {
      any = true;
      return String(v);
    }
    return EMPTY;
  });
  if (!any) return null;
  const out = raw
    .replace(new RegExp(`\\s*${SEP}\\s*${EMPTY}`, 'g'), '')
    .replace(new RegExp(`${EMPTY}\\s*${SEP}\\s*`, 'g'), '')
    .replace(new RegExp(EMPTY, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
  return out || null;
}

/**
 * Map a raw record to a LookupOption using a display field and an id field.
 *
 * Label precedence (ADR-0079):
 *   1. `titleFormat` template (when supplied, derived from the referenced
 *      object's schema) — e.g. `"Acme - John Doe"`.
 *   2. the explicit `displayField` value on the record.
 *   3. the unified `@object-ui/core#getRecordDisplayName` against the referenced
 *      object's schema (`objectDef`) — adds `displayNameField` + type-aware
 *      field derivation, so a lookup to an object whose name lives in e.g.
 *      `activity_name` resolves a real name instead of the raw id. We stop short
 *      of the resolver's `Record #<id>` floor here so the chip still falls
 *      through to the bare id when nothing nameable exists.
 *   4. the legacy hard-coded name list, then the raw id.
 */
function recordToOption(
  record: any,
  displayField: string,
  idField: string,
  descriptionField?: string,
  titleFormat?: string | null,
  objectDef?: any,
): LookupOption {
  const val = record[idField] ?? record.id ?? record._id ?? record.externalId;
  const templated = titleFormat ? formatRecordTitle(record, titleFormat) : null;

  // Object-level resolver fallback (displayNameField + derivation), excluding
  // its id floor so we don't shadow the explicit `String(val)` tail.
  let unified: string | undefined;
  if (objectDef) {
    const resolved = getRecordDisplayName(objectDef, record);
    const id = record?.id ?? record?._id;
    const isFloor =
      resolved === 'Untitled' ||
      (id !== null && id !== undefined && resolved === `Record #${id}`);
    if (!isFloor) unified = resolved;
  }

  const label =
    templated ??
    record[displayField] ??
    unified ??
    record.label ??
    record.name ??
    record.full_name ??
    record.title ??
    record.subject ??
    record.externalId ??
    String(val);
  const description = descriptionField ? record[descriptionField] : undefined;
  return { value: val, label: String(label), description, ...record };
}

/**
 * A reference value can arrive JSON-encoded — e.g. an unresolved external-id
 * reference `'{"externalId":"Website Relaunch"}'`. Parse such a string into its
 * object form so the inline editor resolves it through the same path as a
 * server-`$expand`ed record. Returns null for anything that isn't a JSON object
 * string. Mirrors the read cell (`LookupCellRenderer`) so the two stay aligned.
 */
function parseReferenceObjectString(v: any): Record<string, any> | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return null;
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Map a LookupColumnDef.type to a filter input type for the filter bar.
 * Returns undefined if the field type is not filterable.
 */
function mapFieldTypeToFilterType(
  fieldType: string,
): RecordPickerFilterColumn['type'] | undefined {
  const mapping: Record<string, RecordPickerFilterColumn['type']> = {
    text: 'text',
    number: 'number',
    currency: 'number',
    percent: 'number',
    select: 'select',
    status: 'select',
    date: 'date',
    datetime: 'date',
    boolean: 'boolean',
  };
  return mapping[fieldType];
}

/**
 * Lookup field for selecting related records.
 * Supports single and multi-select with search.
 *
 * When a `dataSource` is provided (either via props, via `field.dataSource`,
 * or via SchemaRendererContext), the dialog will dynamically load records
 * from the referenced object using `DataSource.find()`.
 * Falls back to static `options` when no DataSource is available.
 */
export function LookupField({ value, onChange, field, readonly, ...props }: FieldWidgetProps<any>) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useFieldTranslation();
  const listboxId = React.useId();

  // Create-new error is local; the popover's fetch state (search/loading/error/
  // total/options) is sourced from the shared useRecordQuery kernel below.
  const [createError, setCreateError] = useState<string | null>(null);

  // Records selected via RecordPickerDialog (Level 2).
  // Stored as LookupOption so that findOption can resolve display labels
  // even when the record wasn't part of the Level 1 popover fetch.
  const [pickerResolvedRecords, setPickerResolvedRecords] = useState<LookupOption[]>([]);

  // Arrow-key active index (-1 = none)
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const lookupField = (field || (props as any).schema) as any;

  // When rendered via createFieldRenderer wrapper the actual objectSchema field
  // metadata (reference_to, display_field, etc.) lives at lookupField.field.
  // Unwrap it so lookup-specific properties resolve correctly.
  // ObjectStack convention uses `reference` while the types use `reference_to`,
  // so we check for both property names.
  const innerField = lookupField?.field;
  const fieldMeta = (innerField && typeof innerField === 'object' && ('reference_to' in innerField || 'reference' in innerField || 'type' in innerField))
    ? innerField
    : lookupField;

  const staticOptions: LookupOption[] = fieldMeta?.options || [];
  const multiple = fieldMeta?.multiple || false;
  const displayField = fieldMeta?.display_field || fieldMeta?.displayField || fieldMeta?.reference_field || 'name';
  const descriptionField: string | undefined = fieldMeta?.description_field ?? fieldMeta?.descriptionField;
  const idField = fieldMeta?.id_field || 'id';
  // ObjectStack convention uses `reference`; types define `reference_to` — support both
  const referenceTo: string | undefined = fieldMeta?.reference_to || fieldMeta?.reference;
  // Inline quick-create — a STANDARD capability, default ON for user-facing
  // relations: an empty/zero-result picker offers to create the referenced
  // record (opening its create form; see handleCreateNew) so the first related
  // record can be made right here. An explicit `allowCreate` (either casing)
  // wins — set it `false` to opt a field out; system/user-directory references
  // are excluded from the default (isUserFacingReference).
  const explicitAllowCreate = fieldMeta?.allow_create ?? fieldMeta?.allowCreate;
  const allowCreate: boolean =
    explicitAllowCreate != null ? !!explicitAllowCreate : isUserFacingReference(referenceTo);

  // Enterprise Record Picker configuration
  const lookupColumns: Array<string | LookupColumnDef> | undefined = fieldMeta?.lookup_columns ?? fieldMeta?.lookupColumns;
  const lookupPageSize: number | undefined = fieldMeta?.lookup_page_size ?? fieldMeta?.lookupPageSize;
  const lookupFilters: import('@object-ui/types').LookupFilterDef[] | undefined = fieldMeta?.lookup_filters ?? fieldMeta?.lookupFilters;

  // Search-first PeoplePicker opt-in (user fields). When `picker === 'search'`
  // the Level-2 picker is the rich PeoplePicker (avatar rows + selection tray)
  // instead of the classic table dialog. `subtitle`/`avatar_field` drive the rows.
  const pickerVariant: string | undefined = fieldMeta?.picker;
  const subtitleFields: string[] | undefined = fieldMeta?.subtitle;
  const avatarField: string = fieldMeta?.avatar_field ?? fieldMeta?.avatarField ?? 'image';

  /**
   * Dependent lookups — restrict candidates based on values of *other* fields
   * in the same form. Two shapes are accepted:
   *
   * 1. `depends_on: ['country']` → shorthand. The dependent field value is sent
   *    as both the filter field and the source field (i.e. `country = ${country}`).
   * 2. `depends_on: [{ field: 'country', param: 'country_id' }]` → explicit.
   *    The remote field name (`param`) can differ from the local field name.
   *
   * When any dependency is empty, the lookup is gated and the user sees a
   * helpful "Select {field} first" hint instead of unfiltered records.
   */
  const dependsOn = useMemo<Array<{ field: string; param: string }>>(() => {
    const raw = fieldMeta?.depends_on ?? fieldMeta?.dependsOn;
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((d: any) =>
        typeof d === 'string' ? { field: d, param: d } : { field: d.field, param: d.param ?? d.field },
      );
    }
    return [];
  }, [fieldMeta?.depends_on, fieldMeta?.dependsOn]);

  // Resolve dependent field values from explicit prop or SchemaRendererContext.data
  const dependentValuesProp = (props as any).dependentValues as Record<string, any> | undefined;

  // Resolve DataSource: explicit prop > field-level > wrapper field > SchemaRendererContext > none
  const ctx = useContext(SchemaRendererContext);
  const contextDataSource = ctx?.dataSource ?? null;
  const dataSource: DataSource | null =
    (props as any).dataSource ?? lookupField?.dataSource ?? fieldMeta?.dataSource ?? contextDataSource;

  /** Resolve dependent values from the explicit prop (preferred), the form-data
   *  context provided by @object-ui/react, or finally `ctx.data` (record scope). */
  const resolvedDependentValues: Record<string, any> = useMemo(() => {
    if (dependentValuesProp) return dependentValuesProp;
    return (ctx?.formValues ?? ctx?.data ?? {}) as Record<string, any>;
  }, [dependentValuesProp, ctx?.formValues, ctx?.data]);

  /** True when at least one dependency is missing (empty). The picker is gated
   *  in that state so we never issue an unfiltered query that ignores the
   *  user's earlier choices. */
  const dependenciesMissing = useMemo(() => {
    if (dependsOn.length === 0) return false;
    return dependsOn.some(({ field }) => {
      const v = resolvedDependentValues[field];
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    });
  }, [dependsOn, resolvedDependentValues]);

  const hasDataSource = dataSource != null && typeof dataSource.find === 'function' && !!referenceTo;

  // Fetch the referenced object's schema so we can render option labels via
  // its `titleFormat` template (e.g. `{full_name}`, `{case_number} - {subject}`).
  // Without this the label fell back to a non-existent `name` field and
  // ultimately to the raw record id.
  const [refObjectSchema, setRefObjectSchema] = useState<any>(null);
  useEffect(() => {
    if (!dataSource || !referenceTo) return;
    const getSchema = (dataSource as any).getObjectSchema;
    if (typeof getSchema !== 'function') return;
    let alive = true;
    Promise.resolve(getSchema.call(dataSource, referenceTo))
      .then((s: any) => { if (alive) setRefObjectSchema(s); })
      .catch(() => { /* fall back to displayField chain */ });
    return () => { alive = false; };
  }, [dataSource, referenceTo]);

  const refTitleFormat: string | null = useMemo(() => {
    const raw = refObjectSchema?.titleFormat;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object' && typeof raw.source === 'string') return raw.source;
    return null;
  }, [refObjectSchema]);

  /**
   * Picker columns. Honour explicit `lookup_columns` when authored; otherwise
   * derive a multi-column, disambiguating set from the referenced object's
   * schema so every lookup gets a useful picker with zero field-level config.
   */
  const pickerColumns = useMemo<Array<string | LookupColumnDef> | undefined>(() => {
    if (lookupColumns && lookupColumns.length > 0) return lookupColumns;
    const derived = deriveLookupColumns(refObjectSchema, { displayField });
    return derived.length > 0 ? derived : undefined;
  }, [lookupColumns, refObjectSchema, displayField]);

  /**
   * Secondary line under each quick-select option. Honour explicit
   * `description_field`; otherwise reuse the first derived non-display column so
   * the inline popover also benefits from the richer schema.
   */
  const effectiveDescriptionField = useMemo<string | undefined>(() => {
    if (descriptionField) return descriptionField;
    const extra = pickerColumns?.find((c) => (typeof c === 'string' ? c : c.field) !== displayField);
    if (!extra) return undefined;
    return typeof extra === 'string' ? extra : extra.field;
  }, [descriptionField, pickerColumns, displayField]);

  // Derive filter-bar columns from any typed picker columns.
  const filterColumns = useMemo<RecordPickerFilterColumn[] | undefined>(() => {
    if (!pickerColumns) return undefined;
    const cols: RecordPickerFilterColumn[] = [];
    for (const c of pickerColumns) {
      if (typeof c === 'object' && c.type) {
        const filterType = mapFieldTypeToFilterType(c.type);
        if (filterType) cols.push({ field: c.field, label: c.label, type: filterType });
      }
    }
    return cols.length > 0 ? cols : undefined;
  }, [pickerColumns]);

  // Optional create-new callback
  const onCreateNew: ((searchQuery: string) => void) | undefined =
    (props as any).onCreateNew ?? lookupField?.onCreateNew;

  // State for the full Record Picker dialog (Level 2)
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  // Dependent-lookup chain as a hard QueryParams.$filter record. Shared by
  // EVERY candidate surface — quick-select popover, Level-2 table picker and
  // the search-first PeoplePicker — so no picker can bypass the cascade
  // (#2215: the table picker used to list the full unfiltered set).
  const dependentFilter = useMemo<Record<string, any> | undefined>(() => {
    const f: Record<string, any> = {};
    for (const { field, param } of dependsOn) {
      const v = resolvedDependentValues[field];
      if (v === undefined || v === null || v === '') continue;
      f[param] = typeof v === 'number' ? v : String(v);
    }
    return Object.keys(f).length > 0 ? f : undefined;
  }, [dependsOn, resolvedDependentValues]);

  // Determine which options to display
  // Quick-select popover fetch — the shared record-query kernel (same one the
  // Record Picker dialog and PeoplePicker use). Filter = dependent-lookup chain
  // + base lookupFilters, so the popover matches the full picker.
  const popoverFilter = useMemo<Record<string, any> | undefined>(() => {
    const f: Record<string, any> = {
      ...(lookupFilters && lookupFilters.length > 0 ? lookupFiltersToRecord(lookupFilters) : {}),
      ...(dependentFilter ?? {}),
    };
    return Object.keys(f).length > 0 ? f : undefined;
  }, [dependentFilter, lookupFilters]);

  const popoverQuery = useRecordQuery({
    dataSource,
    objectName: referenceTo,
    enabled: isOpen && hasDataSource && !dependenciesMissing,
    pageSize: LOOKUP_PAGE_SIZE,
    filter: popoverFilter,
  });

  // Re-source the popover's fetch state from the kernel; all existing read sites
  // (searchQuery / loading / error / totalCount / fetchedOptions) stay unchanged.
  const searchQuery = popoverQuery.search;
  const loading = popoverQuery.loading;
  const totalCount = popoverQuery.total;
  const error = popoverQuery.error ?? createError;
  const fetchedOptions = useMemo(
    () =>
      popoverQuery.records.map(r =>
        recordToOption(r, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema),
      ),
    [popoverQuery.records, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema],
  );

  const allOptions = hasDataSource ? fetchedOptions : staticOptions;

  // For static options, filter locally based on search
  const filteredOptions = useMemo(() => {
    if (hasDataSource) return allOptions;
    if (!searchQuery) return allOptions;
    const q = searchQuery.toLowerCase();
    return allOptions.filter(opt =>
      opt.label.toLowerCase().includes(q) ||
      (opt.description && opt.description.toLowerCase().includes(q))
    );
  }, [hasDataSource, allOptions, searchQuery]);

  // Reset active index when options change
  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions.length]);

  // Reset the keyboard cursor when the popover closes. Fetch state (records,
  // search, error, total) is owned by `popoverQuery` and resets automatically
  // when it becomes disabled (via `enabled`), including its debounced search.
  useEffect(() => {
    if (!isOpen) setActiveIndex(-1);
  }, [isOpen]);

  // Search is the kernel's debounced setter.
  const handleSearchChange = useCallback(
    (query: string) => popoverQuery.setSearch(query),
    [popoverQuery.setSearch],
  );

  /**
   * Hydrate the picker's display when the field already has a value (e.g.
   * edit-mode load, prefill via query-string from a related-list "+ New")
   * but no option resolves it yet. Fetches the referenced record(s) via
   * the DataSource and caches them in `pickerResolvedRecords` so the chip
   * shows a friendly label instead of an empty placeholder.
   */
  useEffect(() => {
    if (!hasDataSource || !dataSource || !referenceTo) return;
    const raw: any[] = multiple
      ? Array.isArray(value) ? value : []
      : value != null && value !== '' ? [value] : [];
    // Expanded-reference values (server `$expand`, or their JSON-encoded string
    // form) already carry their display fields and resolve directly in
    // `resolveSelectedOption` — only bare ids need a fetch. Passing an object (or
    // a JSON string) to `findOne` would query for a bogus id and leave the
    // trigger stuck on the placeholder.
    const ids = raw.filter(
      (v) => v != null && v !== '' && typeof v !== 'object' && !parseReferenceObjectString(v),
    );
    if (!ids.length) return;
    // Only fetch records we haven't resolved yet.
    const unresolved = ids.filter((v) => !findOption(v));
    if (!unresolved.length) return;

    let cancelled = false;
    (async () => {
      try {
        const fetched: LookupOption[] = [];
        for (const id of unresolved) {
          if (typeof (dataSource as any).findOne === 'function') {
            const rec = await (dataSource as any).findOne(referenceTo, id);
            if (rec) fetched.push(recordToOption(rec, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema));
          } else {
            const res = await dataSource.find(referenceTo, {
              $filter: { [idField]: id },
              $top: 1,
            } as QueryParams);
            const rows = res?.data ?? res ?? [];
            if (rows[0]) fetched.push(recordToOption(rows[0], displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema));
          }
        }
        if (!cancelled && fetched.length) {
          setPickerResolvedRecords((prev) => {
            const map = new Map(prev.map((o) => [o.value, o]));
            for (const o of fetched) map.set(o.value, o);
            return Array.from(map.values());
          });
        }
      } catch {
        // Ignore — chip will fall back to showing the raw id.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, hasDataSource, referenceTo, displayField, idField, effectiveDescriptionField, multiple]);

  // Get selected option(s) — check static, fetched, and picker-resolved options
  const findOption = useCallback(
    (v: any): LookupOption | undefined => {
      return (
        staticOptions.find(opt => opt.value === v) ??
        fetchedOptions.find(opt => opt.value === v) ??
        pickerResolvedRecords.find(opt => opt.value === v)
      );
    },
    [staticOptions, fetchedOptions, pickerResolvedRecords],
  );

  // String-coerced fallback for `findOption` — matches the read cell's tolerant
  // `String(a) === String(b)` comparison so a numeric cell value still resolves
  // against a string-keyed option (and vice versa). Only consulted when the
  // strict match misses, so homogeneous option lists are unaffected.
  const findOptionLoose = useCallback(
    (v: any): LookupOption | undefined => {
      const key = String(v);
      return (
        staticOptions.find(opt => String(opt.value) === key) ??
        fetchedOptions.find(opt => String(opt.value) === key) ??
        pickerResolvedRecords.find(opt => String(opt.value) === key)
      );
    },
    [staticOptions, fetchedOptions, pickerResolvedRecords],
  );

  // Collapse an expanded-reference value (the related record object returned by
  // server `$expand`) to its bare id — used for option matching / highlighting.
  const normalizeId = useCallback(
    (raw: any): any => {
      const obj = raw != null && typeof raw === 'object' ? raw : parseReferenceObjectString(raw);
      return obj ? (obj[idField] ?? obj.id ?? obj._id ?? obj.externalId) : raw;
    },
    [idField],
  );

  // Resolve a raw field value into its display option. An expanded-reference
  // object is mapped directly (mirroring the read cell's display-name path) so
  // the inline editor shows the record's name instead of the placeholder; a bare
  // id resolves through the static / fetched / picker-hydrated option lists.
  const resolveSelectedOption = useCallback(
    (raw: any): LookupOption | undefined => {
      if (raw == null || raw === '') return undefined;
      // An expanded-reference object (server `$expand`) — or its JSON-encoded
      // string form, e.g. an external-id reference `'{"externalId":"…"}'` — is
      // mapped directly, mirroring the read cell (`LookupCellRenderer`).
      const asObject = typeof raw === 'object' ? raw : parseReferenceObjectString(raw);
      if (asObject) {
        return recordToOption(asObject, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema);
      }
      // Bare id: strict match first, then a String()-coerced fallback so a
      // numeric cell value still resolves against a string-keyed option (and
      // vice versa) — matching the read cell's tolerant comparison.
      return findOption(raw) ?? findOptionLoose(raw);
    },
    [findOption, findOptionLoose, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema],
  );

  const selectedOptions = multiple
    ? (Array.isArray(value) ? value : []).map(resolveSelectedOption).filter(Boolean)
    : value ? [resolveSelectedOption(value)].filter(Boolean) : [];

  // Optional: receive the FULL selected record (not just its id) so a host can
  // auto-fill sibling fields from it — e.g. a line-item grid copying a product's
  // unit_price/description when the item is chosen. When provided (single
  // select), it drives the update and the host owns the resulting value change.
  const onSelectRecord = (props as any).onSelectRecord as ((record: LookupOption) => void) | undefined;

  const handleSelect = useCallback(
    (option: LookupOption) => {
      // Cache the picked option so its label resolves synchronously and durably,
      // independent of the popover's `fetchedOptions` (which the editor may have
      // remounted away, or which a slow/contended re-render hasn't surfaced yet —
      // the intermittent CI failure where a just-picked lookup showed no label,
      // #2150). `selectedOptions` consults `pickerResolvedRecords` in `findOption`.
      if (option && option.value != null) {
        setPickerResolvedRecords((prev) => {
          const map = new Map(prev.map((o) => [o.value, o]));
          map.set(option.value, option);
          return Array.from(map.values());
        });
      }
      if (multiple) {
        // Normalise any expanded-reference objects to bare ids so toggling
        // compares like-for-like and always persists ids (never mixed shapes).
        const currentValues = (Array.isArray(value) ? value : []).map(normalizeId);
        const isSelected = currentValues.includes(option.value);

        if (isSelected) {
          onChange(currentValues.filter((v: any) => v !== option.value));
        } else {
          if (referenceTo) pushRecentLookupId(referenceTo, option.value);
          onChange([...currentValues, option.value]);
        }
      } else {
        if (referenceTo) pushRecentLookupId(referenceTo, option.value);
        if (onSelectRecord) onSelectRecord(option);
        else onChange(option.value);
        setIsOpen(false);
      }
    },
    [multiple, value, onChange, onSelectRecord, referenceTo, normalizeId],
  );

  const handleRemove = (optionValue: any) => {
    if (multiple) {
      const currentValues = (Array.isArray(value) ? value : []).map(normalizeId);
      onChange(currentValues.filter((v: any) => v !== optionValue));
    } else {
      onChange(null);
    }
  };

  // Callback from RecordPickerDialog — caches selected records so that
  // findOption can resolve display labels after the dialog closes.
  const handlePickerSelectRecords = useCallback(
    (records: any[]) => {
      const mapped = records.map(r => recordToOption(r, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema));
      if (referenceTo) mapped.forEach((o) => pushRecentLookupId(referenceTo, o.value));
      setPickerResolvedRecords(mapped);
    },
    [displayField, idField, effectiveDescriptionField, refTitleFormat, referenceTo],
  );

  // ── Recently-used, quick-create, combined option list ────────────────────
  const [recentOptions, setRecentOptions] = useState<LookupOption[]>([]);
  useEffect(() => {
    if (!isOpen || !hasDataSource || !dataSource || !referenceTo || searchQuery) return;
    const ids = getRecentLookupIds(referenceTo);
    if (!ids.length) { setRecentOptions([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const recs: LookupOption[] = [];
        for (const id of ids) {
          const cached = findOption(id);
          if (cached) { recs.push(cached); continue; }
          if (typeof (dataSource as any).findOne === 'function') {
            const r = await (dataSource as any).findOne(referenceTo, id);
            if (r) recs.push(recordToOption(r, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema));
          }
        }
        if (!cancelled) setRecentOptions(recs);
      } catch { if (!cancelled) setRecentOptions([]); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hasDataSource, referenceTo, searchQuery]);

  // Recently-used first (only before the user types), then live results — one
  // de-duped list that drives BOTH rendering and arrow-key navigation.
  const recentCount = (!searchQuery && hasDataSource) ? recentOptions.length : 0;
  const visibleOptions = useMemo(() => {
    if (searchQuery || !hasDataSource || recentOptions.length === 0) return filteredOptions;
    const recentIds = new Set(recentOptions.map((o) => o.value));
    return [...recentOptions, ...filteredOptions.filter((o) => !recentIds.has(o.value))];
  }, [searchQuery, hasDataSource, recentOptions, filteredOptions]);
  useEffect(() => { setActiveIndex(-1); }, [visibleOptions.length]);

  const [creating, setCreating] = useState(false);
  // Open the referenced object's create form through the ActionProvider's modal
  // handler (when a form host wired one). Safe outside a provider — useAction
  // returns a local runner and useHasActionProvider is false.
  const { execute } = useAction();
  const hasActionProvider = useHasActionProvider();
  const canCreate = !!onCreateNew || (allowCreate && (hasActionProvider || hasDataSource));
  const handleCreateNew = useCallback(
    async (q: string) => {
      const label = (q || '').trim();
      if (onCreateNew) { onCreateNew(label); setIsOpen(false); return; }
      if (!allowCreate || !referenceTo) return;
      setCreateError(null);

      // Preferred path — open the referenced object's FULL create form so the
      // user fills every required field themselves, then select the record they
      // created. This is the standard "create related record" behaviour: it
      // works for ANY object (not only ones whose sole required field is the
      // title) and turns an empty required picker from a dead end into a way to
      // author the first related record.
      if (hasActionProvider) {
        setIsOpen(false); // close the picker popover first
        // Defer opening the create dialog until the popover has fully closed and
        // returned focus to the field trigger. Two nested-modal bugs come from
        // opening it in the same tick as the triggering click:
        //  1) the just-mounted Dialog treats this click's release (and the
        //     popover's own dismiss) as an outside-interaction and flashes shut
        //     on the FIRST click (works on the second);
        //  2) with the popover already gone, the "+ create" button that Radix
        //     would return focus to is unmounted, so when the nested modal later
        //     closes focus leaks to <body> and dismisses the PARENT form's dialog
        //     too ("Cancel closes both").
        // A macrotask runs after Radix's focus-return layout effects, so focus is
        // safely back on the still-mounted field trigger before the Dialog opens.
        await new Promise((r) => setTimeout(r, 0));
        const result: any = await execute({
          type: 'modal',
          modal: { objectName: referenceTo, mode: 'create' },
        } as any);
        if (result?.success && result.data) {
          const opt = recordToOption(result.data, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema);
          setPickerResolvedRecords((prev) => [opt, ...prev.filter((o) => o.value !== opt.value)]);
          handleSelect(opt);
          return;
        }
        // `success` + an echoed `modal` schema means no modal handler was wired
        // in this tree → fall through to the legacy inline create. Anything else
        // (cancel / no data) means the user backed out → stop.
        if (!(result?.success && result.modal)) return;
      }

      // Fallback (no modal handler in scope): the legacy one-field inline create
      // from the typed text. Best-effort; surfaces any validation error inline.
      if (!dataSource || !label) return;
      setCreating(true);
      try {
        const created = await (dataSource as any).create(referenceTo, { [displayField]: label });
        const opt = recordToOption(created, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema);
        setPickerResolvedRecords((prev) => [opt, ...prev.filter((o) => o.value !== opt.value)]);
        handleSelect(opt);
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : String(err));
      } finally {
        setCreating(false);
      }
    },
    [onCreateNew, allowCreate, referenceTo, hasActionProvider, execute, dataSource, displayField, idField, effectiveDescriptionField, refTitleFormat, refObjectSchema, handleSelect],
  );

  // Compact one-line preview of an option's extra (non-display) columns —
  // shown as a native tooltip so users can disambiguate without opening it.
  const previewOf = useCallback(
    (option: LookupOption): string | undefined => {
      if (!pickerColumns || pickerColumns.length === 0) return undefined;
      const parts: string[] = [];
      for (const c of pickerColumns) {
        const f = typeof c === 'string' ? c : c.field;
        if (f === displayField) continue;
        const v = (option as any)[f];
        if (v === null || v === undefined || v === '') continue;
        const lbl = typeof c === 'string' ? f : (c.label || f);
        const text = typeof v === 'object' ? (v.name ?? v.label ?? JSON.stringify(v)) : v;
        parts.push(`${lbl}: ${text}`);
      }
      return parts.length ? parts.join(' · ') : undefined;
    },
    [pickerColumns, displayField],
  );

  // Keyboard handler for the search input — arrow keys + Enter
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex(prev =>
          prev < visibleOptions.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < visibleOptions.length) {
          handleSelect(visibleOptions[activeIndex]);
        }
      }
    },
    [visibleOptions, activeIndex, handleSelect],
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const el = listRef.current.querySelector(`[data-lookup-index="${activeIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  if (readonly) {
    if (!selectedOptions.length) {
      return <EmptyValue />;
    }

    if (multiple) {
      return (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => (
            <Badge key={idx} variant="outline">
              {opt?.label || opt?.[displayField]}
            </Badge>
          ))}
        </div>
      );
    }

    return (
      <span className="text-sm">
        {selectedOptions[0]?.label || selectedOptions[0]?.[displayField]}
      </span>
    );
  }

  // Compact mode (e.g. inside a line-item grid cell): show the selected value
  // INSIDE a borderless trigger on a single line — no chip stacked above a
  // separate "Select…" button (which double-stacks and wastes the row height).
  const compact = !!(props as any).compact;
  const singleSelectedLabel = selectedOptions[0]?.label || selectedOptions[0]?.[displayField];

  // Shared field trigger — the anchor for either the inline PeoplePicker
  // (search fields) or the classic quick-select popover. No onClick: the Radix
  // trigger it is slotted into (PopoverTrigger / SheetTrigger) owns open/close.
  const triggerButton = (
    <Button
      variant="outline"
      className={cn(
        'min-w-0 flex-1 justify-start text-left font-normal',
        compact && 'h-8 rounded-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-1 focus-visible:ring-ring/60',
      )}
      type="button"
      disabled={dependenciesMissing || (props as any).disabled}
      data-testid={dependenciesMissing ? 'lookup-trigger-gated' : (((props as any).name || lookupField?.name) ? `lookup-trigger-${(props as any).name || lookupField.name}` : 'lookup-trigger')}
      title={dependenciesMissing
        ? t('lookup.selectFirst', { fields: dependsOn.map(d => d.field).join(', ') })
        : undefined}
    >
      <Search className={cn('size-4 shrink-0 text-muted-foreground', compact ? 'mr-1.5' : 'mr-2')} />
      <span className={cn('truncate', compact && selectedOptions.length === 0 && 'text-muted-foreground')}>
        {dependenciesMissing
          ? t('lookup.selectFirst', { fields: dependsOn.map(d => d.field).join(', ') })
          : compact && !multiple && selectedOptions.length > 0
            ? singleSelectedLabel
            : selectedOptions.length === 0
              ? lookupField?.placeholder || t('common.select')
              : multiple ? t('table.selected', { count: selectedOptions.length }) : t('common.select')}
      </span>
    </Button>
  );

  return (
    <div className={compact ? '' : 'space-y-2'}>
      {/* Selected values display (full mode only — compact shows it in-trigger) */}
      {selectedOptions.length > 0 && !compact && (
        <div className="flex flex-wrap gap-1">
          {selectedOptions.map((opt, idx) => {
            const chipLabel = opt?.label || opt?.[displayField];
            // Search-first (people) fields show avatar chips; classic lookups
            // keep the plain text Badge.
            if (pickerVariant === 'search') {
              const avatarUrl = (opt as any)?.[avatarField] || (opt as any)?.image;
              return (
                <span
                  key={idx}
                  data-testid="people-field-chip"
                  className="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-1.5 text-sm"
                >
                  <Avatar className="size-6 shrink-0">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={String(chipLabel || '')} />}
                    <AvatarFallback className="text-[10px]">
                      {getPersonInitials(String(chipLabel || ''))}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[10rem] truncate">{chipLabel}</span>
                  <button
                    onClick={() => handleRemove(opt?.value)}
                    className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    type="button"
                    aria-label={t('lookup.remove', { label: chipLabel })}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            }
            return (
              <Badge key={idx} variant="outline" className="gap-1">
                {chipLabel}
                <button
                  onClick={() => handleRemove(opt?.value)}
                  className="ml-1 hover:text-destructive"
                  type="button"
                  aria-label={t('lookup.remove', { label: chipLabel })}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Field control: search-first inline combobox (anchored dropdown / mobile
          sheet), else the classic quick-select popover. */}
      {pickerVariant === 'search' && hasDataSource && dataSource && referenceTo ? (
        <PeoplePicker
          inline
          trigger={triggerButton}
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          title={lookupField?.label || t('common.select')}
          multiple={multiple}
          dataSource={dataSource}
          objectName={referenceTo}
          displayField={displayField}
          idField={idField}
          subtitleFields={subtitleFields}
          avatarField={avatarField}
          pageSize={lookupPageSize}
          value={value}
          onSelect={onChange}
          onSelectRecords={handlePickerSelectRecords}
          lookupFilters={lookupFilters}
          baseFilter={dependentFilter}
        />
      ) : (
      <div className="flex items-center gap-1.5">
      <Popover
        open={isOpen}
        onOpenChange={(o) => {
          if (!dependenciesMissing) setIsOpen(o);
        }}
      >
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          {/* Search input */}
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={t('common.search') + '...'}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 h-8 text-sm"
                role="combobox"
                aria-autocomplete="list"
                aria-controls={listboxId}
                aria-expanded={isOpen}
                aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
              />
              {loading && (
                <Loader2
                  className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground"
                  data-testid="lookup-loading"
                />
              )}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex flex-col items-center gap-2 py-4 px-2" role="alert">
              <AlertCircle className="size-5 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => popoverQuery.refetch()}
                type="button"
              >
                {t('lookup.retry')}
              </Button>
            </div>
          )}

          {/* Loading state (initial load only, not search refinement) */}
          {loading && filteredOptions.length === 0 && !error && (
            <div className="flex flex-col items-center gap-2 py-6" role="status" aria-live="polite">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{t('lookup.loading')}</p>
            </div>
          )}

          {/* Options list */}
          {!error && !(loading && filteredOptions.length === 0) && (
            <div ref={listRef} className="max-h-64 overflow-y-auto px-1 pb-1" role="listbox" id={listboxId}>
              {visibleOptions.length === 0 ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t('lookup.noOptions')}
                  </p>
                  {/* Quick-create entry */}
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 gap-1"
                      type="button"
                      disabled={creating}
                      onClick={() => handleCreateNew(searchQuery)}
                    >
                      {creating ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                      {searchQuery ? t('lookup.createNamed', { name: searchQuery }) : t('lookup.createNew')}
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {visibleOptions.map((option, idx) => {
                    const isSelected = multiple
                      ? (Array.isArray(value) ? value : []).map(normalizeId).includes(option.value)
                      : normalizeId(value) === option.value;
                    const isActive = idx === activeIndex;
                    const showRecentHeader = recentCount > 0 && idx === 0;
                    const showResultsHeader = recentCount > 0 && idx === recentCount;

                    return (
                      <React.Fragment key={option.value}>
                        {showRecentHeader && (
                          <div className="px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t('lookup.recentlyUsed')}
                          </div>
                        )}
                        {showResultsHeader && (
                          <div className="mt-1 border-t px-3 pt-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            {t('lookup.allResults')}
                          </div>
                        )}
                        <button
                          id={`${listboxId}-opt-${idx}`}
                          data-lookup-index={idx}
                          role="option"
                          aria-selected={isSelected}
                          title={previewOf(option)}
                          onClick={() => handleSelect(option)}
                          className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center justify-between ${
                            isActive
                              ? 'bg-accent text-accent-foreground'
                              : isSelected
                                ? 'bg-accent/50 text-accent-foreground'
                                : ''
                          }`}
                          type="button"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate">{option.label}</span>
                            {option.description && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {option.description}
                              </span>
                            )}
                          </div>
                          {isSelected && (
                            <Badge variant="default" className="ml-2 shrink-0">{t('lookup.selectedBadge')}</Badge>
                          )}
                        </button>
                      </React.Fragment>
                    );
                  })}
                  {/* Show total count when fetched from DataSource */}
                  {hasDataSource && totalCount > filteredOptions.length && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      {t('lookup.showingResults', { shown: filteredOptions.length, total: totalCount })}
                    </p>
                  )}
                  {/* "Show All Results" button — opens the full Record Picker (Level 2) */}
                  {hasDataSource && totalCount > filteredOptions.length && (
                    <button
                      type="button"
                      className="w-full text-center px-3 py-2 rounded-md text-sm font-medium text-primary hover:bg-accent flex items-center justify-center gap-1.5"
                      onClick={() => {
                        setIsOpen(false);
                        setIsPickerOpen(true);
                      }}
                      data-testid="show-all-results"
                    >
                      <TableProperties className="size-3.5" />
                      {t('lookup.showAllResults', { count: totalCount })}
                    </button>
                  )}
                  {/* Quick-create entry (below results) */}
                  {canCreate && (
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-accent flex items-center gap-1.5 text-muted-foreground"
                      disabled={creating}
                      onClick={() => handleCreateNew(searchQuery)}
                    >
                      {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
                      {searchQuery ? t('lookup.createNamed', { name: searchQuery }) : t('lookup.createNew')}
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* "Browse All" button — classic lookups only; search fields open the
          PeoplePicker from the trigger itself, so this would be redundant. */}
      {hasDataSource && pickerVariant !== 'search' && (
        <Button
          variant="outline"
          size="icon"
          className="shrink-0"
          type="button"
          // Gated exactly like the main trigger (#2215) — pre-fix this button
          // opened the full unscoped table while the dependency was missing.
          disabled={dependenciesMissing || (props as any).disabled}
          onClick={() => setIsPickerOpen(true)}
          aria-label={t('lookup.browseAll')}
          title={dependenciesMissing
            ? t('lookup.selectFirst', { fields: dependsOn.map(d => d.field).join(', ') })
            : t('lookup.browseAll')}
          data-testid="browse-all-records"
        >
          <TableProperties className="size-4" />
        </Button>
      )}
      </div>
      )}

      {/* Level 2: classic table picker — search fields use the inline combobox above. */}
      {hasDataSource && dataSource && referenceTo && pickerVariant !== 'search' && (
        <RecordPickerDialog
          open={isPickerOpen}
          onOpenChange={setIsPickerOpen}
          title={lookupField?.label || t('common.select')}
          multiple={multiple}
          dataSource={dataSource}
          objectName={referenceTo}
          columns={pickerColumns}
          displayField={displayField}
          titleFormat={refTitleFormat}
          idField={idField}
          pageSize={lookupPageSize}
          value={value}
          onSelect={onChange}
          onSelectRecords={handlePickerSelectRecords}
          lookupFilters={lookupFilters}
          baseFilter={dependentFilter}
          cellRenderer={getCellRendererResolver()}
          filterColumns={filterColumns}
        />
      )}
    </div>
  );
}
