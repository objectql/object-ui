/**
 * CreateViewDialog — Airtable-style "Create new view" modal.
 *
 * Step 1: User picks a view type from a visual grid of cards (icon + label
 * + short description). Selection is highlighted.
 * Step 2: For view types that need them, the user picks the required
 * configuration fields (e.g. the group-by field for kanban, the start-date
 * field for calendar/timeline/gantt, lat/lng for map, image for gallery).
 *   The Create button stays disabled until every required field is set.
 * Step 3: The user enters a name (required, defaults to "Grid 1" etc.).
 *
 * On submit, calls `onCreate({ type, label, [type]: {...required fields} })`.
 * The parent is responsible for actually persisting the view (we keep this
 * component pure — no dataSource coupling).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Button,
  cn,
} from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import {
  deriveFieldOptions,
  isImageLikeField,
  isGeoLikeField,
  pickPreferredField,
  KANBAN_GROUP_PREFERRED,
  PRIMARY_DATE_PREFERRED,
  END_DATE_PREFERRED,
  type FieldOption,
} from '@object-ui/plugin-view';
import {
  LayoutGrid,
  KanbanSquare,
  Calendar as CalendarIcon,
  Image as ImageIcon,
  GanttChartSquare,
  Clock,
  Map as MapIcon,
  BarChart3,
  ListTree,
  AlertCircle,
} from 'lucide-react';

export interface CreateViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called with a fully-formed view config payload. Required type-specific
   * fields are nested under their type key (e.g. `kanban.groupByField`),
   * matching the @objectstack/spec NamedListView shape.
   */
  onCreate: (config: Record<string, any> & { type: string; label: string }) => void;
  /** Used to suggest unique default names like "Grid 2" if "Grid 1" exists. */
  existingLabels?: string[];
  /** Restrict the available view types. Defaults to all built-in types. */
  availableTypes?: string[];
  /**
   * Object definition. Provides the available fields used to populate the
   * required field selectors (group-by, start-date, etc.). When omitted,
   * required-field validation is skipped.
   */
  objectDef?: { name: string; label?: string; fields?: Record<string, any>; [key: string]: any };
}

interface ViewTypeMeta {
  type: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

function buildViewTypeMeta(t: (k: string) => string): ViewTypeMeta[] {
  return [
    { type: 'grid',     icon: LayoutGrid,       label: t('console.objectView.viewTypeGrid'),     description: t('console.objectView.viewTypeGridDesc') },
    { type: 'kanban',   icon: KanbanSquare,     label: t('console.objectView.viewTypeKanban'),   description: t('console.objectView.viewTypeKanbanDesc') },
    { type: 'calendar', icon: CalendarIcon,     label: t('console.objectView.viewTypeCalendar'), description: t('console.objectView.viewTypeCalendarDesc') },
    { type: 'gallery',  icon: ImageIcon,        label: t('console.objectView.viewTypeGallery'),  description: t('console.objectView.viewTypeGalleryDesc') },
    { type: 'timeline', icon: Clock,            label: t('console.objectView.viewTypeTimeline'), description: t('console.objectView.viewTypeTimelineDesc') },
    { type: 'gantt',    icon: GanttChartSquare, label: t('console.objectView.viewTypeGantt'),    description: t('console.objectView.viewTypeGanttDesc') },
    { type: 'map',      icon: MapIcon,          label: t('console.objectView.viewTypeMap'),      description: t('console.objectView.viewTypeMapDesc') },
    { type: 'chart',    icon: BarChart3,        label: t('console.objectView.viewTypeChart'),    description: t('console.objectView.viewTypeChartDesc') },
    { type: 'tree',     icon: ListTree,         label: t('console.objectView.viewTypeTree'),     description: t('console.objectView.viewTypeTreeDesc') },
  ];
}

/** Suggest a non-colliding default name like "Grid 1", "Grid 2", … */
function suggestName(typeLabel: string, existing: Set<string>): string {
  for (let i = 1; i < 1000; i++) {
    const candidate = `${typeLabel} ${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return typeLabel;
}

// ---------------------------------------------------------------------------
// Required-field schema per view type
// ---------------------------------------------------------------------------
//
// Each entry describes the sub-config keys a view type *must* have set before
// a record can be persisted. Aligned with the @objectstack/spec NamedListView
// shape (kanban.groupByField, calendar.startDateField, gantt.startDateField +
// endDateField, gallery.imageField, map.latitudeField + longitudeField,
// chart.chartType + xAxisField + yAxisFields).
//
// `filter` narrows the dropdown options so users only see appropriate fields
// (e.g. only date fields for date selectors; only image/file/url fields for
// gallery covers; only lat-named numeric fields for map latitude).
//
// `kind: 'enum'` renders a static-options select instead of a field selector,
// used for chart.chartType.
//
// `preferred` provides a list of name substrings to auto-pick when the user
// hasn't chosen anything yet — improves first-run quality of common cases
// (kanban→status, calendar→start_date, …).

interface RequiredFieldDef {
  /** Sub-config key under the type (e.g. "groupByField") */
  key: string;
  /** i18n key for the label */
  i18nKey: string;
  /** i18n key for an optional helper text under the select. */
  helpI18nKey?: string;
  /** Filter the field options. Returns true to keep. */
  filter?: (f: FieldOption) => boolean;
  /** Preferred name substrings for smart-default auto-pick. */
  preferred?: readonly string[];
  /** When 'enum', renders a static options select with `enumOptions`. */
  kind?: 'field' | 'enum';
  /** Static options for `kind: 'enum'` selects. */
  enumOptions?: ReadonlyArray<{ value: string; i18nKey: string }>;
  /** Default value to seed when the dialog first opens (for enum). */
  defaultValue?: string;
}

const CHART_TYPE_OPTIONS = [
  { value: 'bar',     i18nKey: 'console.objectView.chartTypeBar' },
  { value: 'line',    i18nKey: 'console.objectView.chartTypeLine' },
  { value: 'pie',     i18nKey: 'console.objectView.chartTypePie' },
  { value: 'area',    i18nKey: 'console.objectView.chartTypeArea' },
  { value: 'scatter', i18nKey: 'console.objectView.chartTypeScatter' },
] as const;

const REQUIRED_FIELDS_BY_TYPE: Record<string, RequiredFieldDef[]> = {
  kanban: [
    {
      key: 'groupByField',
      i18nKey: 'console.objectView.groupByField',
      helpI18nKey: 'console.objectView.groupByFieldHelp',
      filter: (f) => f.type === 'select' || f.type === 'boolean',
      preferred: KANBAN_GROUP_PREFERRED,
    },
  ],
  calendar: [
    {
      key: 'startDateField',
      i18nKey: 'console.objectView.startDateField',
      helpI18nKey: 'console.objectView.startDateFieldHelp',
      filter: (f) => f.type === 'date',
      preferred: PRIMARY_DATE_PREFERRED,
    },
    {
      key: 'titleField',
      i18nKey: 'console.objectView.titleField',
      helpI18nKey: 'console.objectView.titleFieldHelp',
      filter: (f) => f.type === 'text',
    },
  ],
  timeline: [
    {
      key: 'startDateField',
      i18nKey: 'console.objectView.startDateField',
      helpI18nKey: 'console.objectView.timelineDateFieldHelp',
      filter: (f) => f.type === 'date',
      preferred: PRIMARY_DATE_PREFERRED,
    },
    {
      key: 'titleField',
      i18nKey: 'console.objectView.titleField',
      helpI18nKey: 'console.objectView.titleFieldHelp',
      filter: (f) => f.type === 'text',
    },
  ],
  gantt: [
    {
      key: 'startDateField',
      i18nKey: 'console.objectView.startDateField',
      helpI18nKey: 'console.objectView.ganttStartDateFieldHelp',
      filter: (f) => f.type === 'date',
      preferred: PRIMARY_DATE_PREFERRED,
    },
    {
      key: 'endDateField',
      i18nKey: 'console.objectView.endDateField',
      helpI18nKey: 'console.objectView.ganttEndDateFieldHelp',
      filter: (f) => f.type === 'date',
      preferred: END_DATE_PREFERRED,
    },
    {
      key: 'titleField',
      i18nKey: 'console.objectView.titleField',
      helpI18nKey: 'console.objectView.titleFieldHelp',
      filter: (f) => f.type === 'text',
    },
  ],
  gallery: [
    {
      key: 'coverField',
      i18nKey: 'console.objectView.imageField',
      helpI18nKey: 'console.objectView.imageFieldHelp',
      filter: (f) => isImageLikeField(f),
    },
  ],
  map: [
    {
      key: 'latitudeField',
      i18nKey: 'console.objectView.latitudeField',
      helpI18nKey: 'console.objectView.latitudeFieldHelp',
      filter: (f) => f.type === 'number' && isGeoLikeField(f, 'latitude'),
    },
    {
      key: 'longitudeField',
      i18nKey: 'console.objectView.longitudeField',
      helpI18nKey: 'console.objectView.longitudeFieldHelp',
      filter: (f) => f.type === 'number' && isGeoLikeField(f, 'longitude'),
    },
  ],
  chart: [
    {
      key: 'chartType',
      i18nKey: 'console.objectView.chartType',
      helpI18nKey: 'console.objectView.chartTypeHelp',
      kind: 'enum',
      enumOptions: CHART_TYPE_OPTIONS,
      defaultValue: 'bar',
    },
    {
      key: 'xAxisField',
      i18nKey: 'console.objectView.xAxisField',
      helpI18nKey: 'console.objectView.xAxisFieldHelp',
      filter: (f) => f.type === 'select' || f.type === 'boolean' || f.type === 'date' || f.type === 'text',
      preferred: KANBAN_GROUP_PREFERRED,
    },
    {
      key: 'yAxisFields',
      i18nKey: 'console.objectView.yAxisField',
      helpI18nKey: 'console.objectView.yAxisFieldHelp',
      filter: (f) => f.type === 'number',
    },
  ],
  tree: [
    {
      key: 'parentField',
      i18nKey: 'console.objectView.parentField',
      helpI18nKey: 'console.objectView.parentFieldHelp',
      // Self-referencing pointer: a `tree` field, or a lookup/master_detail
      // back to the same object. `rawType` carries the unnormalized field type.
      filter: (f) =>
        f.rawType === 'tree' ||
        f.rawType === 'lookup' ||
        f.rawType === 'master_detail',
    },
  ],
  // grid has no strictly required fields at create time
};

export function CreateViewDialog({
  open,
  onOpenChange,
  onCreate,
  existingLabels,
  availableTypes,
  objectDef,
}: CreateViewDialogProps) {
  const { t } = useObjectTranslation();
  const allTypes = useMemo(() => buildViewTypeMeta(t), [t]);
  const types = useMemo(
    () => (availableTypes && availableTypes.length > 0
      ? allTypes.filter(v => availableTypes.includes(v.type))
      : allTypes),
    [allTypes, availableTypes],
  );
  // Stabilise the existing-labels list across renders so we don't churn the
  // `existingSet` memo (and the dependent useEffects) on every parent render.
  // Callers commonly pass `views.map(v => v.label)` inline, which is a fresh
  // array each render — without this normalisation, the name-suggest effect
  // below would re-fire indefinitely and could trigger "Maximum update depth"
  // when the array contents are stable but the reference is not.
  const existingKey = (existingLabels ?? []).join('\u0000');
  const existingSet = useMemo(
    () => new Set(existingLabels ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [existingKey],
  );
  const fieldOptions = useMemo(() => (objectDef ? deriveFieldOptions(objectDef) : []), [objectDef]);

  const [selectedType, setSelectedType] = useState<string>(types[0]?.type ?? 'grid');
  const [label, setLabel] = useState<string>('');
  const [touched, setTouched] = useState(false);
  /** Map of `${type}.${fieldKey}` → selected field name. Per-type so switching
   *  view types preserves the user's earlier choices in case they switch back. */
  const [requiredFieldValues, setRequiredFieldValues] = useState<Record<string, string>>({});

  // Reset when the dialog opens, and re-suggest name whenever type changes
  // (only while the user hasn't manually edited it yet).
  useEffect(() => {
    if (open) {
      setSelectedType(types[0]?.type ?? 'grid');
      setTouched(false);
      setRequiredFieldValues({});
    }
  }, [open, types]);

  useEffect(() => {
    if (!touched) {
      const meta = types.find(v => v.type === selectedType);
      setLabel(suggestName(meta?.label ?? 'View', existingSet));
    }
  }, [selectedType, touched, types, existingSet]);

  // Required fields for the currently selected type
  const requiredFields = REQUIRED_FIELDS_BY_TYPE[selectedType] ?? [];

  /** True when this required field has at least one eligible option (or is an
   *  enum/has no filter). Used by both submit-gating and type-grid disabling. */
  const hasEligible = (rf: RequiredFieldDef): boolean => {
    if (rf.kind === 'enum') return (rf.enumOptions?.length ?? 0) > 0;
    if (!objectDef) return true; // no objectDef → skip eligibility checks
    const eligible = rf.filter ? fieldOptions.filter(rf.filter) : fieldOptions;
    return eligible.length > 0;
  };

  /** Map: viewType -> reason ("missing field type") if it can't be created.
   *  Computed once per render so the type grid knows which cards to disable. */
  const typeUnavailability = useMemo(() => {
    const out: Record<string, RequiredFieldDef | null> = {};
    types.forEach((vt) => {
      const reqs = REQUIRED_FIELDS_BY_TYPE[vt.type] ?? [];
      const blocker = reqs.find((rf) => !hasEligible(rf));
      out[vt.type] = blocker ?? null;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [types, fieldOptions, objectDef]);

  const getRequiredValue = (key: string) => requiredFieldValues[`${selectedType}.${key}`] ?? '';
  const setRequiredValue = (key: string, value: string) =>
    setRequiredFieldValues(prev => ({ ...prev, [`${selectedType}.${key}`]: value }));

  const trimmed = label.trim();
  const isDuplicate = trimmed.length > 0 && existingSet.has(trimmed);
  const allRequiredFilled = requiredFields.every(f => getRequiredValue(f.key).length > 0);
  const canSubmit = trimmed.length > 0 && !isDuplicate && allRequiredFilled;

  // Auto-pick a sensible default for any required field. Runs whenever the
  // type or available options change, but only fills slots the user hasn't
  // touched yet. Strategy:
  //   - enum: seed with `defaultValue` (e.g. chart → 'bar')
  //   - field with single eligible option: pick it (saves a click)
  //   - field with multiple eligibles + `preferred`: pick the first match
  //     in the preferred list (e.g. kanban groupBy → status > stage > …)
  useEffect(() => {
    if (requiredFields.length === 0) return;
    requiredFields.forEach((rf) => {
      if (getRequiredValue(rf.key).length > 0) return;
      if (rf.kind === 'enum') {
        if (rf.defaultValue) setRequiredValue(rf.key, rf.defaultValue);
        return;
      }
      const eligible = rf.filter ? fieldOptions.filter(rf.filter) : fieldOptions;
      if (eligible.length === 0) return;
      if (eligible.length === 1) {
        setRequiredValue(rf.key, eligible[0].value);
        return;
      }
      const picked = pickPreferredField(eligible, rf.preferred ?? []);
      if (picked) setRequiredValue(rf.key, picked);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, fieldOptions]);

  const handleSubmit = () => {
    if (!canSubmit) return;
    // Bundle required fields under their type-specific sub-key, matching the
    // NamedListView spec (e.g. { type: "kanban", kanban: { groupByField: ... } }).
    // `yAxisFields` is wrapped in an array per spec (chart supports multi-y).
    const subConfig: Record<string, any> = {};
    requiredFields.forEach((rf) => {
      const v = getRequiredValue(rf.key);
      if (!v) return;
      subConfig[rf.key] = rf.key === 'yAxisFields' ? [v] : v;
    });
    const payload: Record<string, any> & { type: string; label: string } = {
      type: selectedType,
      label: trimmed,
    };
    if (Object.keys(subConfig).length > 0) {
      payload[selectedType] = subConfig;
    }
    onCreate(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[560px]"
        data-testid="create-view-dialog"
      >
        <DialogHeader>
          <DialogTitle>{t('console.objectView.createView')}</DialogTitle>
          <DialogDescription>
            {t('console.objectView.createViewDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 py-2" data-testid="create-view-type-grid">
          {types.map(({ type, label: typeLabel, description, icon: Icon }) => {
            const selected = type === selectedType;
            const blocker = typeUnavailability[type];
            const disabled = !!blocker;
            const disabledTitle = disabled
              ? t('console.objectView.viewTypeUnavailable', { field: t(blocker!.i18nKey) })
              : undefined;
            return (
              <button
                key={type}
                type="button"
                data-testid={`create-view-type-${type}`}
                aria-pressed={selected}
                aria-disabled={disabled}
                disabled={disabled}
                title={disabledTitle}
                onClick={() => { if (!disabled) setSelectedType(type); }}
                className={cn(
                  'group flex flex-col items-start gap-1 rounded-lg border bg-background p-3 text-left transition-colors',
                  !disabled && 'hover:border-primary/60 hover:bg-accent/40',
                  selected && !disabled
                    ? 'border-primary ring-2 ring-primary/30 bg-accent/40'
                    : 'border-border',
                  disabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5',
                    selected && !disabled
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                <div className="text-xs font-medium leading-tight">{typeLabel}</div>
                <div className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                  {disabled ? t('console.objectView.viewTypeUnavailableShort') : description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Required type-specific configuration */}
        {requiredFields.length > 0 && (
          <div className="space-y-3 rounded-md border border-dashed bg-muted/30 p-3" data-testid="create-view-required-fields">
            {requiredFields.map((rf) => {
              const selectedFieldValue = getRequiredValue(rf.key);
              const isEnum = rf.kind === 'enum';
              const eligible = isEnum
                ? []
                : (rf.filter ? fieldOptions.filter(rf.filter) : fieldOptions);
              const noEligible = !isEnum && fieldOptions.length > 0 && eligible.length === 0;
              return (
                <div key={rf.key} className="space-y-1">
                  <label
                    htmlFor={`create-view-required-${rf.key}`}
                    className="text-xs font-medium"
                  >
                    {t(rf.i18nKey)}
                    <span className="ml-1 text-destructive">*</span>
                  </label>
                  <select
                    id={`create-view-required-${rf.key}`}
                    data-testid={`create-view-required-${rf.key}`}
                    value={selectedFieldValue}
                    onChange={(e) => setRequiredValue(rf.key, e.target.value)}
                    disabled={noEligible}
                    className={cn(
                      'h-9 w-full rounded-md border bg-background px-2 text-xs',
                      'border-input',
                    )}
                  >
                    <option value="">
                      {isEnum ? t('console.objectView.selectOption') : t('console.objectView.selectField')}
                    </option>
                    {isEnum
                      ? rf.enumOptions!.map(opt => (
                          <option key={opt.value} value={opt.value}>{t(opt.i18nKey)}</option>
                        ))
                      : eligible.map(f => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                  </select>
                  {rf.helpI18nKey && !noEligible && (
                    <p className="text-[11px] text-muted-foreground">
                      {t(rf.helpI18nKey)}
                    </p>
                  )}
                  {noEligible && (
                    <p
                      className="flex items-center gap-1 text-[11px] text-destructive"
                      data-testid={`create-view-error-no-field-${rf.key}`}
                    >
                      <AlertCircle className="h-3 w-3" />
                      {t('console.objectView.noEligibleFieldForType')}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="create-view-name-input" className="text-xs font-medium">
            {t('console.objectView.title')}
            <span className="ml-1 text-destructive">*</span>
          </label>
          <Input
            id="create-view-name-input"
            data-testid="create-view-name-input"
            autoFocus
            value={label}
            onChange={(e) => { setLabel(e.target.value); setTouched(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
            placeholder={t('console.objectView.newView')}
            className="h-9"
          />
          {isDuplicate && (
            <p className="text-[11px] text-destructive" data-testid="create-view-error-duplicate">
              {t('console.objectView.duplicateViewName')}
            </p>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="create-view-cancel"
          >
            {t('console.objectView.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            data-testid="create-view-submit"
          >
            {t('console.objectView.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
