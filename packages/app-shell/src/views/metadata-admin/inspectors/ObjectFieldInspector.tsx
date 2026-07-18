// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectFieldInspector — scoped editor for the selected Object field.
 *
 * Selection shape:  { kind: 'field', id: '<field_name>' }
 *
 * The inspector edits one field at a time. Sections:
 *   • Basic     — name (rename), label, type, required, unique, description
 *   • Specific  — picklist options / lookup target / formula / numeric
 *                 precision / max length, conditional on type
 *   • Advanced  — readonly, hidden, indexed, externalId, group
 *
 * All edits are applied as immutable splices of `draft.fields` via
 * the object-fields-io helpers, preserving the original array-vs-record
 * shape AND any unknown keys on the field definition.
 *
 * Rename: changing the `name` rewrites the field's key in-place and
 * re-issues the selection so the inspector stays bound to the same
 * field. Other fields/options that reference the old name are NOT
 * auto-rewritten — callers should re-validate downstream.
 */

import * as React from 'react';
import type { MetadataInspectorProps } from '../inspector-registry';
import { MetadataClient } from '@object-ui/data-objectstack';
import { useMetadataClient } from '../useMetadata';
import {
  InspectorShell,
  InspectorReorderButtons,
  InspectorTextField,
  InspectorNumberField,
  InspectorSelectField,
  InspectorCheckboxField,
  InspectorRemoveButton,
  InspectorEmptyState,
  moveArray,
} from './_shared';
import { Button, Input, Label, Badge } from '@object-ui/components';
import { Plus, X, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { InspectorComboField, type InspectorComboOption } from './InspectorComboField';
import { useObjectFields } from '../previews/useObjectFields';
import {
  readFields,
  writeFields,
  toFieldNameLoose,
  indexOfField,
  type FieldsView,
  type FieldEntry,
} from '../previews/object-fields-io';
import {
  FIELD_TYPE_META,
  TYPES_BY_CATEGORY,
  CATEGORY_LABEL_EN,
  CATEGORY_LABEL_ZH,
  type FieldTypeId,
} from '../previews/field-types';
import { CelPredicateField } from '../CelPredicateField';
import { t, tFormat } from '../i18n';

const isZh = (locale?: string) => (locale ?? '').toLowerCase().startsWith('zh');

interface Option {
  value: string;
  label?: string;
  color?: string;
}

/* ─────────────── Helpers ─────────────── */

function readOptions(def: Record<string, unknown>): Option[] {
  const raw = def.options;
  if (!Array.isArray(raw)) return [];
  return raw.map((o: any) => ({
    value: String(o?.value ?? ''),
    label: typeof o?.label === 'string' ? o.label : undefined,
    color: typeof o?.color === 'string' ? o.color : undefined,
  }));
}

function isPicklist(type: string): boolean {
  return type === 'select' || type === 'multiselect' || type === 'radio' || type === 'checkboxes';
}

function isLookup(type: string): boolean {
  return type === 'lookup' || type === 'master_detail' || type === 'tree';
}

function isComputed(type: string): boolean {
  return type === 'formula' || type === 'summary';
}

function isNumeric(type: string): boolean {
  return type === 'number' || type === 'currency' || type === 'percent';
}

function isTexty(type: string): boolean {
  return type === 'text' || type === 'textarea' || type === 'email' || type === 'url' || type === 'phone' || type === 'password';
}

type DefaultKind = 'bool' | 'number' | 'picklist' | 'text';

/**
 * Which default-value editor (if any) fits a field type. Computed,
 * relational, media and structural types have no meaningful literal
 * default in this UI, so they return null (no editor rendered).
 */
function defaultValueKind(type: string): DefaultKind | null {
  if (type === 'boolean' || type === 'toggle') return 'bool';
  if (type === 'number' || type === 'currency' || type === 'percent') return 'number';
  if (type === 'select' || type === 'radio') return 'picklist';
  const noDefault = [
    'formula', 'summary', 'autonumber',
    'lookup', 'master_detail', 'tree',
    'file', 'image', 'avatar', 'video', 'audio', 'signature', 'qrcode',
    'composite', 'repeater', 'vector',
    'multiselect', 'checkboxes', 'tags',
  ];
  if (noDefault.includes(type)) return null;
  return 'text';
}

/**
 * The scope roots a field conditional rule can actually reference at runtime:
 * `@object-ui/core`'s `evalFieldPredicate` binds the live record as `record`,
 * the saved record as `previous`, and (for master-detail line items) the
 * header as `parent` — nothing else (no `current_user`), so the autocomplete
 * must not advertise the wider RLS/flow root set (objectui#1582).
 */
const FIELD_RULE_ROOTS = ['record', 'previous', 'parent'];

/**
 * The only scope root a formula `expression` can reference: the engine
 * evaluates it against the live record alone — there is no `previous`
 * (formulas are recomputed on read, not diffed against a prior version) and
 * no `parent` (objectui#1582 follow-up).
 */
const FORMULA_ROOTS = ['record'];

/** Read a `*When` predicate for editing: a bare string or an Expression envelope's `source`. */
function readPredicate(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && typeof (v as { source?: unknown }).source === 'string') {
    return (v as { source: string }).source;
  }
  return '';
}

/**
 * Write an edited predicate back. Empty clears the rule; a value authored over
 * an existing `{ dialect, source }` envelope preserves the envelope's other
 * keys (`meta.rationale` from an AI draft, etc.) instead of collapsing to a
 * bare string; otherwise the spec-blessed bare-string shorthand is written.
 */
function writePredicate(orig: unknown, next: string): unknown {
  if (!next.trim()) return undefined;
  if (orig && typeof orig === 'object' && !Array.isArray(orig)) {
    const env = orig as Record<string, unknown>;
    return { ...env, dialect: typeof env.dialect === 'string' ? env.dialect : 'cel', source: next };
  }
  return next;
}

function buildTypeOptions(locale?: string): Array<{ value: string; label: string }> {
  const zh = (locale ?? '').toLowerCase().startsWith('zh');
  const cats = zh ? CATEGORY_LABEL_ZH : CATEGORY_LABEL_EN;
  return TYPES_BY_CATEGORY.flatMap((g) =>
    g.types.map((id) => {
      const m = FIELD_TYPE_META[id];
      return { value: id, label: `${cats[g.category]} · ${zh ? m.labelZh : m.label}` };
    }),
  );
}

/* ─────────────── Inspector ─────────────── */

export function ObjectFieldInspector({
  selection,
  draft,
  onPatch,
  onClearSelection,
  onSelectionChange,
  readOnly,
  locale,
}: MetadataInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);
  const typeOptions = React.useMemo(() => buildTypeOptions(locale), [locale]);
  const view: FieldsView = React.useMemo(() => readFields((draft as any).fields), [draft]);
  const name = String(selection.id);
  const idx = indexOfField(view, name);
  const entry = idx >= 0 ? view.entries[idx] : null;

  const fieldGroups = Array.isArray((draft as any).fieldGroups)
    ? ((draft as any).fieldGroups as Array<{ key?: string; label?: string }>)
    : [];

  const objectOptions = useObjectOptions();

  // Spec `Field.returnType` is stamped from the formula's inferred CEL type,
  // but ONLY once the author actually edits the formula in this session —
  // stamping on mere selection would dirty the draft just by looking at a
  // field whose stored returnType lags the inference.
  const formulaEdited = React.useRef(false);
  React.useEffect(() => {
    formulaEdited.current = false;
  }, [name]);

  if (!entry) {
    return (
      <InspectorShell
        kindLabel={tr('designer.field.kind')}
        title={name || tr('designer.field.kind')}
        onClose={onClearSelection}
        closeLabel={tr('designer.field.close')}
      >
        <InspectorEmptyState message={tr('designer.field.missing')} />
      </InspectorShell>
    );
  }

  const def = entry.def;
  const type = (typeof def.type === 'string' ? def.type : 'text') as FieldTypeId;
  const typeMeta = FIELD_TYPE_META[type];

  /* ─── Patch helpers ─── */

  const writeView = (next: FieldsView) => {
    onPatch({ fields: writeFields(next) });
  };

  const patchDef = (patch: Record<string, unknown>) => {
    const nextEntries = [...view.entries];
    nextEntries[idx] = { ...entry, def: { ...def, ...patch } };
    writeView({ shape: view.shape, entries: nextEntries });
  };

  const setKey = (rawNext: string) => {
    const nextName = toFieldNameLoose(rawNext);
    if (!nextName || nextName === entry.name) return;
    // Disallow collision
    if (view.entries.some((e, i) => i !== idx && e.name === nextName)) return;
    const nextEntries = [...view.entries];
    nextEntries[idx] = { ...entry, name: nextName };
    writeView({ shape: view.shape, entries: nextEntries });
    onSelectionChange?.({ kind: 'field', id: nextName, label: String(def.label ?? nextName) });
  };

  // Derive the API name from the label live, per keystroke — with
  // toFieldNameLoose (prefix-stable, unlike slugify which trims trailing
  // underscores and would fight mid-word typing) — while the name is still
  // an auto-generated default and the user hasn't customised it. Mirrors the
  // object/app Name behaviour. toFieldNameLoose returns '' for non-Latin
  // labels, in which case the unique default name is kept. Pure — the
  // caller applies the label and (if any) the derived name in one write,
  // since two separate writeView() calls from the same stale `entry` closure
  // would have the second clobber the first.
  const deriveNameFor = (label: string): string | null => {
    if (readOnly) return null;
    const base = type === 'select' ? 'status' : type;
    const isAutoName =
      entry.name === base ||
      (entry.name.startsWith(`${base}_`) && /^\d+$/.test(entry.name.slice(base.length + 1))) ||
      // Freshly added fields are named by nextFieldName() as `field_<N>`
      // (StudioDesignSurface.tsx), independent of the field's type — match
      // that scheme too, or a type-typed rename right after add never derives.
      /^field_\d+$/.test(entry.name);
    if (!isAutoName) return null;
    const derived = toFieldNameLoose(label);
    if (!derived || derived === entry.name) return null;
    if (view.entries.some((e, i) => i !== idx && e.name === derived)) return null;
    return derived;
  };

  const removeField = () => {
    const nextEntries = view.entries.filter((_, i) => i !== idx);
    writeView({ shape: view.shape, entries: nextEntries });
    onClearSelection();
  };

  const duplicateField = () => {
    // Clone the field below itself with a collision-free name and a
    // "(copy)" label, then select the clone so it's ready to tweak.
    const existing = new Set(view.entries.map((e) => e.name));
    const base = `${entry.name}_copy`;
    let name = base;
    let n = 1;
    while (existing.has(name)) { n += 1; name = `${base}_${n}`; }
    const labelStr = typeof def.label === 'string' && def.label ? def.label : '';
    const clone: FieldEntry = {
      name,
      def: { ...def, label: labelStr ? labelStr + tr('designer.field.copySuffix') : undefined },
    };
    const nextEntries = [...view.entries];
    nextEntries.splice(idx + 1, 0, clone);
    writeView({ shape: view.shape, entries: nextEntries });
    onSelectionChange?.({ kind: 'field', id: name, label: String(clone.def.label ?? name) });
  };

  const moveTo = (toIndex: number) => {
    const next = { shape: view.shape, entries: moveArray(view.entries, idx, toIndex) };
    writeView(next);
    // Keep selection on the moved field (its name is unchanged).
  };

  /* ─── Option editor ─── */

  const options = readOptions(def);
  const patchOptions = (next: Option[]) => {
    const clean = next.map((o) => {
      const out: Option = { value: o.value };
      if (o.label) out.label = o.label;
      if (o.color) out.color = o.color;
      return out;
    });
    patchDef({ options: clean });
  };

  /* ─── Render ─── */

  const headerActions = (
    <div className="flex items-center gap-1">
      {!readOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={duplicateField}
          title={tr('designer.field.duplicate')}
          aria-label={tr('designer.field.duplicate')}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      )}
      <InspectorReorderButtons
        index={idx}
        total={view.entries.length}
        onMove={moveTo}
        disabled={readOnly}
      />
    </div>
  );

  const footer = (
    <InspectorRemoveButton
      label={tFormat('designer.field.remove', locale, {
        label: typeof def.label === 'string' ? def.label : entry.name,
      })}
      onClick={removeField}
      disabled={readOnly}
    />
  );

  const typeMetaLabel = isZh(locale) ? typeMeta?.labelZh : typeMeta?.label;

  return (
    <InspectorShell
      kindLabel={tr('designer.field.kind')}
      title={typeof def.label === 'string' && def.label ? (def.label as string) : entry.name}
      onClose={onClearSelection}
      closeLabel={tr('designer.field.close')}
      headerActions={headerActions}
      footer={footer}
    >
      {/* Basic */}
      <Section title={tr('designer.field.section.basic')}>
        <InspectorTextField
          label={tr('designer.field.apiName')}
          value={entry.name}
          onCommit={setKey}
          disabled={readOnly}
          mono
          testId="field-apiname-input"
        />
        <InspectorTextField
          label={tr('designer.field.label')}
          value={typeof def.label === 'string' ? (def.label as string) : ''}
          onCommit={(v) => {
            const derivedName = deriveNameFor(v);
            const nextEntries = [...view.entries];
            nextEntries[idx] = {
              ...entry,
              name: derivedName ?? entry.name,
              def: { ...def, label: v },
            };
            writeView({ shape: view.shape, entries: nextEntries });
            if (derivedName) {
              onSelectionChange?.({ kind: 'field', id: derivedName, label: v });
            }
          }}
          disabled={readOnly}
          testId="field-label-input"
        />
        <InspectorSelectField
          label={tr('designer.field.type')}
          value={type}
          options={typeOptions}
          onCommit={(v) => patchDef({ type: v })}
          disabled={readOnly}
        />
        <div className="flex items-center gap-4 pt-1">
          <InspectorCheckboxField
            label={tr('designer.field.required')}
            value={!!def.required}
            onCommit={(v) => patchDef({ required: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label={tr('designer.field.unique')}
            value={!!def.unique}
            onCommit={(v) => patchDef({ unique: v || undefined })}
            disabled={readOnly}
          />
        </div>
        <TextareaField
          label={tr('designer.field.description')}
          value={typeof def.description === 'string' ? (def.description as string) : ''}
          onCommit={(v) => patchDef({ description: v || undefined })}
          disabled={readOnly}
          rows={2}
        />
        {defaultValueKind(type) && (
          <DefaultValueField
            kind={defaultValueKind(type)!}
            value={def.defaultValue}
            options={options}
            onCommit={(v) => patchDef({ defaultValue: v })}
            disabled={readOnly}
            locale={locale}
          />
        )}
        <TextareaField
          label={tr('designer.field.helpText')}
          value={typeof def.inlineHelpText === 'string' ? (def.inlineHelpText as string) : ''}
          onCommit={(v) => patchDef({ inlineHelpText: v || undefined })}
          disabled={readOnly}
          rows={2}
          placeholder={tr('designer.field.helpTextPlaceholder')}
        />
      </Section>

      {/* Type-specific */}
      {(isPicklist(type) || isLookup(type) || isComputed(type) || isNumeric(type) || isTexty(type)) && (
        <Section title={tFormat('designer.field.section.options', locale, { type: typeMetaLabel ?? type })}>
          {isPicklist(type) && (
            <OptionsEditor
              key={entry.name}
              options={options}
              onChange={patchOptions}
              disabled={readOnly}
              locale={locale}
            />
          )}
          {isLookup(type) && (
            <>
              <ObjectPicker
                label={tr('designer.field.relatedObject')}
                value={typeof def.reference === 'string' ? (def.reference as string) : ''}
                options={objectOptions}
                onCommit={(v) => patchDef({ reference: v || undefined })}
                disabled={readOnly}
                placeholder={tr('designer.field.objectNamePlaceholder')}
              />
              <InspectorTextField
                label={tr('designer.field.relationshipName')}
                value={typeof def.relationshipName === 'string' ? (def.relationshipName as string) : ''}
                onCommit={(v) => patchDef({ relationshipName: v || undefined })}
                disabled={readOnly}
                placeholder={tr('designer.field.relationshipNameHint')}
              />
              <LookupConfigFields
                def={def}
                patchDef={patchDef}
                hostFieldNames={view.entries.map((e) => e.name).filter((n) => n !== entry.name)}
                readOnly={readOnly}
                locale={locale}
              />
            </>
          )}
          {type === 'formula' && (
            <CelPredicateField
              id={`field-formula-${entry.name}`}
              label={tr('designer.field.formula')}
              // Legacy alias: older Studio drafts carry a `formula` key the
              // engine never reads (it computes from `expression`); it seeds
              // the editor and the first edit migrates it.
              value={readPredicate(def.expression ?? def.formula)}
              onChange={(v) => {
                formulaEdited.current = true;
                patchDef({
                  expression: writePredicate(def.expression ?? def.formula, v),
                  formula: undefined,
                  ...(v.trim() ? {} : { returnType: undefined }),
                });
              }}
              onInferredTypeChange={(inferred) => {
                if (!formulaEdited.current) return;
                // Spec: `returnType` carries only a PROVEN concrete type —
                // an ambiguous (`unknown`) or unavailable verdict clears it.
                const next = inferred && inferred !== 'unknown' ? inferred : undefined;
                if (def.returnType !== next) patchDef({ returnType: next });
              }}
              disabled={readOnly}
              placeholder="record.amount * 0.2"
              objectName={typeof (draft as any).name === 'string' ? ((draft as any).name as string) : undefined}
              // A formula may reference every sibling, not itself (circular).
              fieldNames={view.entries.map((e) => e.name).filter((n) => n !== entry.name)}
              scope="record"
              roots={FORMULA_ROOTS}
              role="value"
              t={tr}
            />
          )}
          {type === 'summary' && (
            <SummaryConfigFields
              def={def}
              patchDef={patchDef}
              objectOptions={objectOptions}
              readOnly={readOnly}
              locale={locale}
            />
          )}
          {isNumeric(type) && (
            <div className="grid grid-cols-2 gap-2">
              <InspectorNumberField
                label={tr('designer.field.precision')}
                value={typeof def.precision === 'number' ? (def.precision as number) : undefined}
                onCommit={(v) => patchDef({ precision: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label={tr('designer.field.scale')}
                value={typeof def.scale === 'number' ? (def.scale as number) : undefined}
                onCommit={(v) => patchDef({ scale: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label={tr('designer.field.min')}
                value={typeof def.min === 'number' ? (def.min as number) : undefined}
                onCommit={(v) => patchDef({ min: v })}
                disabled={readOnly}
              />
              <InspectorNumberField
                label={tr('designer.field.max')}
                value={typeof def.max === 'number' ? (def.max as number) : undefined}
                onCommit={(v) => patchDef({ max: v })}
                disabled={readOnly}
              />
            </div>
          )}
          {isTexty(type) && (
            <div className="grid grid-cols-2 gap-2">
              <InspectorNumberField
                label={tr('designer.field.minLength')}
                value={typeof def.minLength === 'number' ? (def.minLength as number) : undefined}
                onCommit={(v) => patchDef({ minLength: v })}
                disabled={readOnly}
                placeholder="0"
              />
              <InspectorNumberField
                label={tr('designer.field.maxLength')}
                value={typeof def.maxLength === 'number' ? (def.maxLength as number) : undefined}
                onCommit={(v) => patchDef({ maxLength: v })}
                disabled={readOnly}
                placeholder="255"
              />
            </div>
          )}
        </Section>
      )}

      {/* Advanced */}
      <Section title={tr('designer.field.section.advanced')}>
        <div className="grid grid-cols-2 gap-2">
          <InspectorCheckboxField
            label={tr('designer.field.readonly')}
            value={!!def.readonly}
            onCommit={(v) => patchDef({ readonly: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label={tr('designer.field.hidden')}
            value={!!def.hidden}
            onCommit={(v) => patchDef({ hidden: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label={tr('designer.field.indexed')}
            value={!!def.indexed}
            onCommit={(v) => patchDef({ indexed: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label={tr('designer.field.externalId')}
            value={!!def.externalId}
            onCommit={(v) => patchDef({ externalId: v || undefined })}
            disabled={readOnly}
          />
          <InspectorCheckboxField
            label={tr('designer.field.trackHistory')}
            value={!!def.trackHistory}
            onCommit={(v) => patchDef({ trackHistory: v || undefined })}
            disabled={readOnly}
          />
        </div>
        <InspectorTextField
          label={tr('designer.field.placeholder')}
          value={typeof def.placeholder === 'string' ? (def.placeholder as string) : ''}
          onCommit={(v) => patchDef({ placeholder: v || undefined })}
          disabled={readOnly}
        />
        {/* Conditional rules (ADR-0036 B2) — CEL editors with live lint +
            field autocomplete against THIS object's fields (objectui#1582). */}
        <div className="space-y-2 border-t pt-2.5">
          <div className="text-[11px] font-medium text-muted-foreground">
            {tr('designer.field.conditionalRules')}
          </div>
          <CelPredicateField
            id={`field-rule-visible-${entry.name}`}
            label={tr('designer.field.visibleWhen')}
            value={readPredicate(def.visibleWhen)}
            onChange={(v) => patchDef({ visibleWhen: writePredicate(def.visibleWhen, v) })}
            disabled={readOnly}
            placeholder="record.status != 'draft'"
            objectName={typeof (draft as any).name === 'string' ? ((draft as any).name as string) : undefined}
            fieldNames={view.entries.map((e) => e.name)}
            scope="record"
            roots={FIELD_RULE_ROOTS}
            t={tr}
          />
          <CelPredicateField
            id={`field-rule-readonly-${entry.name}`}
            label={tr('designer.field.readonlyWhen')}
            value={readPredicate(def.readonlyWhen)}
            onChange={(v) => patchDef({ readonlyWhen: writePredicate(def.readonlyWhen, v) })}
            disabled={readOnly}
            placeholder="record.status == 'closed'"
            objectName={typeof (draft as any).name === 'string' ? ((draft as any).name as string) : undefined}
            fieldNames={view.entries.map((e) => e.name)}
            scope="record"
            roots={FIELD_RULE_ROOTS}
            t={tr}
          />
          <CelPredicateField
            id={`field-rule-required-${entry.name}`}
            label={tr('designer.field.requiredWhen')}
            // Legacy alias: `conditionalRequired` (spec @deprecated) reads into
            // the same editor; the first edit migrates it to `requiredWhen`.
            value={readPredicate(def.requiredWhen ?? def.conditionalRequired)}
            onChange={(v) =>
              patchDef({
                requiredWhen: writePredicate(def.requiredWhen ?? def.conditionalRequired, v),
                conditionalRequired: undefined,
              })
            }
            disabled={readOnly}
            placeholder="record.amount > 10000"
            objectName={typeof (draft as any).name === 'string' ? ((draft as any).name as string) : undefined}
            fieldNames={view.entries.map((e) => e.name)}
            scope="record"
            roots={FIELD_RULE_ROOTS}
            t={tr}
          />
          <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-snug">
            {tr('designer.field.conditionalRulesHint')}
          </p>
        </div>
        {fieldGroups.length > 0 && (
          <InspectorSelectField
            label={tr('designer.field.group')}
            value={typeof def.group === 'string' ? (def.group as string) : ''}
            options={[
              { value: '', label: tr('designer.field.noGroup') },
              ...fieldGroups
                .filter((g) => typeof g.key === 'string')
                .map((g) => ({ value: g.key as string, label: String(g.label ?? g.key) })),
            ]}
            onCommit={(v) => patchDef({ group: v || undefined })}
            disabled={readOnly}
          />
        )}
      </Section>
    </InspectorShell>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b pb-1">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Type-aware default-value editor. Stores the literal on `Field.defaultValue`. */
function DefaultValueField({
  kind,
  value,
  options,
  onCommit,
  disabled,
  locale,
}: {
  kind: DefaultKind;
  value: unknown;
  options: Option[];
  onCommit: (v: unknown) => void;
  disabled?: boolean;
  locale?: string;
}) {
  const label = t('designer.field.defaultValue', locale);
  const none = t('designer.field.defaultNone', locale);

  if (kind === 'bool') {
    const cur = value === true ? 'true' : value === false ? 'false' : '';
    return (
      <InspectorSelectField
        label={label}
        value={cur}
        options={[
          { value: '', label: none },
          { value: 'true', label: t('designer.field.true', locale) },
          { value: 'false', label: t('designer.field.false', locale) },
        ]}
        onCommit={(v) => onCommit(v === '' ? undefined : v === 'true')}
        disabled={disabled}
      />
    );
  }

  if (kind === 'number') {
    return (
      <InspectorNumberField
        label={label}
        value={typeof value === 'number' ? value : undefined}
        onCommit={(v) => onCommit(v)}
        disabled={disabled}
      />
    );
  }

  if (kind === 'picklist') {
    return (
      <InspectorSelectField
        label={label}
        value={typeof value === 'string' ? value : ''}
        options={[
          { value: '', label: none },
          ...options
            .filter((o) => o.value)
            .map((o) => ({ value: o.value, label: o.label || o.value })),
        ]}
        onCommit={(v) => onCommit(v || undefined)}
        disabled={disabled}
      />
    );
  }

  return (
    <InspectorTextField
      label={label}
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onCommit={(v) => onCommit(v || undefined)}
      disabled={disabled}
    />
  );
}

function TextareaField({
  label,
  value,
  onCommit,
  disabled,
  rows = 2,
  mono,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  disabled?: boolean;
  rows?: number;
  mono?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <textarea
        value={value}
        disabled={disabled}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onCommit(e.target.value)}
        className={
          'w-full text-sm rounded-md border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary ' +
          (mono ? 'font-mono text-xs ' : '')
        }
      />
    </div>
  );
}

function ObjectPicker({
  label,
  value,
  options,
  onCommit,
  disabled,
  placeholder,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onCommit: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  // List may be empty (still loading or no objects). Allow free-text fallback.
  const listId = React.useId();
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        disabled={disabled}
        className="h-8 text-sm font-mono"
        placeholder={placeholder ?? 'object_name'}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </datalist>
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
  disabled,
  locale,
}: {
  options: Option[];
  onChange: (next: Option[]) => void;
  disabled?: boolean;
  locale?: string;
}) {
  // Local editing buffer. We keep a blank trailing row visible for input but
  // only PERSIST rows whose `value` is non-empty — otherwise the blank row
  // fails the spec identifier rule ("System identifier must be at least 2
  // characters") and shows a confusing error mid-edit. The editor is remounted
  // per field (key={entry.name}), so seeding from `options` once is correct.
  const [rows, setRows] = React.useState<Option[]>(
    () => (options.length > 0 ? options : [{ value: '', label: '' }]),
  );
  const commit = (next: Option[]) => {
    setRows(next);
    onChange(next.filter((o) => o.value.trim() !== ''));
  };
  const update = (i: number, patch: Partial<Option>) => {
    const next = [...rows];
    next[i] = { ...next[i], ...patch };
    commit(next);
  };
  const remove = (i: number) => commit(rows.filter((_, j) => j !== i));
  const move = (i: number, to: number) => commit(moveArray(rows, i, to));
  const add = () => commit([...rows, { value: '', label: '' }]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{t('designer.field.picklistValues', locale)}</Label>
        <Badge variant="outline" className="text-[10px]">{rows.length}</Badge>
      </div>
      {rows.length === 0 ? (
        <div className="text-[11px] italic text-muted-foreground px-1">{t('designer.field.noValues', locale)}</div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((o, i) => (
            // Two rows per option: the value/label inputs get the full panel
            // width (min-w-0 lets them shrink cleanly instead of clipping their
            // own placeholders), while the color swatch and reorder/remove
            // controls sit on a compact strip below — previously all six
            // controls shared one line, squeezing the inputs until "Value" /
            // "Label" and CJK option labels truncated (framework#2615 P3).
            <div key={i} className="rounded-md border border-border/60 p-1.5 space-y-1">
              <div className="flex items-center gap-1">
                <Input
                  value={o.value}
                  onChange={(e) => update(i, { value: e.target.value })}
                  placeholder={t('designer.field.optValue', locale)}
                  disabled={disabled}
                  className="h-7 min-w-0 flex-1 text-xs font-mono"
                />
                <Input
                  value={o.label ?? ''}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder={t('designer.field.optLabel', locale)}
                  disabled={disabled}
                  className="h-7 min-w-0 flex-1 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={o.color ?? '#cccccc'}
                  onChange={(e) => update(i, { color: e.target.value })}
                  disabled={disabled}
                  className="h-6 w-6 rounded border bg-background cursor-pointer p-0.5"
                  title={t('designer.field.optColor', locale)}
                />
                <span className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => move(i, i - 1)}
                  disabled={disabled || i === 0}
                  aria-label={t('designer.field.moveUp', locale)}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => move(i, i + 1)}
                  disabled={disabled || i === rows.length - 1}
                  aria-label={t('designer.field.moveDown', locale)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-destructive"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  aria-label={t('designer.field.removeValue', locale)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!disabled && (
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={add}>
          <Plus className="h-3 w-3" />
          {t('designer.field.addValue', locale)}
        </Button>
      )}
    </div>
  );
}

/* ─────────────── Lookup picker config (displayField / filters / dependent) ─────────────── */

const LOOKUP_OPERATORS: Array<{ value: string; label: string }> = [
  { value: 'eq', label: '= equals' },
  { value: 'ne', label: '≠ not equals' },
  { value: 'gt', label: '> greater than' },
  { value: 'lt', label: '< less than' },
  { value: 'gte', label: '≥ at least' },
  { value: 'lte', label: '≤ at most' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'in (any of)' },
  { value: 'notIn', label: 'not in' },
];

type LookupFilter = { field?: string; operator?: string; value?: unknown };

function readLookupFilters(def: Record<string, unknown>): LookupFilter[] {
  const raw = def.lookupFilters ?? (def as Record<string, unknown>).lookup_filters;
  return Array.isArray(raw) ? (raw as LookupFilter[]) : [];
}

function readDependsOn(def: Record<string, unknown>): string[] {
  const raw = def.dependsOn ?? (def as Record<string, unknown>).depends_on;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => (typeof d === 'string' ? d : d && typeof d === 'object' ? (d as { field?: string }).field : undefined))
    .filter((x): x is string => !!x);
}

/**
 * Lookup/master_detail picker configuration. Surfaces the parts that
 * previously required hand-editing the raw JSON: which field labels each
 * candidate (`displayField`/`descriptionField`), which records are even
 * selectable (structured `lookupFilters` — the form the runtime LookupField
 * actually honours, not the legacy `referenceFilters` strings), and
 * dependent-lookup links to other fields on the same record (`dependsOn`).
 * Every field choice is picked from the referenced object's live schema.
 */
function LookupConfigFields({
  def,
  patchDef,
  hostFieldNames,
  readOnly,
  locale,
}: {
  def: Record<string, unknown>;
  patchDef: (patch: Record<string, unknown>) => void;
  hostFieldNames: string[];
  readOnly?: boolean;
  locale?: string;
}) {
  const tr = (key: string) => t(key, locale);
  const reference = typeof def.reference === 'string' ? (def.reference as string) : undefined;
  const { fields: targetFields, loading } = useObjectFields(reference);

  const fieldOptions: InspectorComboOption[] = React.useMemo(
    () => targetFields.filter((f) => !f.hidden).map((f) => ({ value: f.name, label: f.label, hint: f.type })),
    [targetFields],
  );
  const hostOptions: InspectorComboOption[] = React.useMemo(
    () => hostFieldNames.map((n) => ({ value: n, label: n })),
    [hostFieldNames],
  );

  const filters = readLookupFilters(def);
  const dependsOn = readDependsOn(def);

  const patchFilter = (i: number, patch: Partial<LookupFilter>) =>
    patchDef({ lookupFilters: filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)) });
  const addFilter = () => patchDef({ lookupFilters: [...filters, { field: '', operator: 'eq', value: '' }] });
  const removeFilter = (i: number) => {
    const next = filters.filter((_, idx) => idx !== i);
    patchDef({ lookupFilters: next.length ? next : undefined });
  };

  // `in` / `notIn` take a list; everything else a scalar. Keep the editor a
  // single text input and (de)serialize the list form at the boundary.
  const valueToText = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v));
  const textToValue = (op: string | undefined, s: string): unknown =>
    op === 'in' || op === 'notIn' ? s.split(',').map((x) => x.trim()).filter(Boolean) : s;

  const addDependsOn = (name: string) => {
    if (!name || dependsOn.includes(name)) return;
    patchDef({ dependsOn: [...dependsOn, name] });
  };
  const removeDependsOn = (name: string) => {
    const next = dependsOn.filter((n) => n !== name);
    patchDef({ dependsOn: next.length ? next : undefined });
  };

  const displayField = typeof def.displayField === 'string' ? (def.displayField as string) : '';
  const descriptionField = typeof def.descriptionField === 'string' ? (def.descriptionField as string) : '';
  const pageSize = typeof def.lookupPageSize === 'number' ? (def.lookupPageSize as number) : undefined;
  const allowCreate = def.allowCreate === true;
  const fieldPlaceholder = reference ? tr('designer.field.lookup.selectField') : tr('designer.field.lookup.setTargetFirst');

  return (
    <div className="space-y-2 border-t pt-2.5">
      <div className="text-[11px] font-medium text-muted-foreground">{tr('designer.field.lookup.pickerConfig')}</div>

      <InspectorComboField
        label={tr('designer.field.lookup.displayField')}
        value={displayField}
        onCommit={(v) => patchDef({ displayField: v || undefined })}
        options={fieldOptions}
        loading={loading}
        placeholder={fieldPlaceholder}
        searchPlaceholder={tr('designer.field.lookup.searchFields')}
        disabled={readOnly}
        mono
      />
      <InspectorComboField
        label={tr('designer.field.lookup.descriptionField')}
        value={descriptionField}
        onCommit={(v) => patchDef({ descriptionField: v || undefined })}
        options={fieldOptions}
        loading={loading}
        placeholder={fieldPlaceholder}
        searchPlaceholder={tr('designer.field.lookup.searchFields')}
        disabled={readOnly}
        mono
      />

      {/* Structured selectable-records filter (lookupFilters) */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">{tr('designer.field.lookup.selectableRecords')}</Label>
            <Badge variant="outline" className="text-[10px]">{filters.length}</Badge>
          </div>
          {!readOnly && (
            <Button type="button" variant="ghost" size="sm" className="h-6 gap-1 px-1.5 text-[11px]" onClick={addFilter}>
              <Plus className="h-3 w-3" /> {tr('designer.field.lookup.addFilter')}
            </Button>
          )}
        </div>
        {filters.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            {tFormat('designer.field.lookup.noFilter', locale, { ref: reference || 'related' })}
          </p>
        ) : (
          filters.map((f, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{tFormat('designer.field.lookup.filterN', locale, { n: i + 1 })}</span>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" aria-label={tr('designer.field.lookup.removeFilter')} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFilter(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <InspectorComboField
                label={tr('designer.field.lookup.filterField')}
                value={f.field ?? ''}
                onCommit={(v) => patchFilter(i, { field: v })}
                options={fieldOptions}
                loading={loading}
                placeholder={fieldPlaceholder}
                searchPlaceholder={tr('designer.field.lookup.searchFields')}
                disabled={readOnly}
                mono
              />
              <InspectorSelectField label={tr('designer.field.lookup.filterOperator')} value={f.operator ?? 'eq'} options={LOOKUP_OPERATORS} onCommit={(v) => patchFilter(i, { operator: v })} disabled={readOnly} />
              <InspectorTextField
                label={tr('designer.field.lookup.filterValue')}
                value={valueToText(f.value)}
                onCommit={(v) => patchFilter(i, { value: textToValue(f.operator, v) })}
                placeholder={f.operator === 'in' || f.operator === 'notIn' ? 'comma,separated,values' : 'value'}
                disabled={readOnly}
                mono
              />
            </div>
          ))
        )}
      </div>

      {/* Dependent lookup (dependsOn) — narrow candidates by other fields on this record */}
      <div className="space-y-1.5 pt-1">
        <Label className="text-xs text-muted-foreground">{tr('designer.field.lookup.dependsOn')}</Label>
        {dependsOn.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {dependsOn.map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded bg-secondary px-2 py-0.5 text-[11px] font-mono">
                {n}
                {!readOnly && (
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => removeDependsOn(n)} aria-label={`Remove ${n}`}>×</button>
                )}
              </span>
            ))}
          </div>
        )}
        {!readOnly && hostOptions.length > 0 && (
          <InspectorComboField
            value=""
            onCommit={(v) => addDependsOn(v)}
            options={hostOptions.filter((o) => !dependsOn.includes(o.value))}
            placeholder={tr('designer.field.lookup.addDependsOn')}
            searchPlaceholder={tr('designer.field.lookup.searchHostFields')}
            disabled={readOnly}
            allowCustom={false}
            mono
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <InspectorNumberField label={tr('designer.field.lookup.pageSize')} value={pageSize} onCommit={(v) => patchDef({ lookupPageSize: v })} placeholder="10" disabled={readOnly} />
        <div className="flex items-end pb-1.5">
          <InspectorCheckboxField label={tr('designer.field.lookup.allowCreate')} value={allowCreate} onCommit={(v) => patchDef({ allowCreate: v || undefined })} disabled={readOnly} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Roll-up summary config (summaryOperations) ─────────────── */

const SUMMARY_FUNCTIONS = ['count', 'sum', 'min', 'max', 'avg'] as const;

interface SummaryOps {
  object?: string;
  field?: string;
  function?: string;
  relationshipField?: string;
  /** FilterCondition (query `where` object) restricting which child rows aggregate. */
  filter?: Record<string, unknown>;
}

function readSummaryOps(def: Record<string, unknown>): SummaryOps {
  const raw = def.summaryOperations;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as SummaryOps) : {};
}

/* ─── summary `filter` ⇆ structured rows ───────────────────────────────────
 * The spec models `summaryOperations.filter` as a FilterCondition OBJECT
 * (`{ status: 'approved' }`, `{ amount: { $gte: 500 } }`). The inspector edits
 * it as field/operator/value rows (the same shape as lookupFilters), converting
 * both ways. A filter using logic the rows can't represent ($or/$not/nested) is
 * flagged `advanced` so the editor shows it read-only instead of clobbering it. */
type SummaryFilterRow = { field: string; operator: string; value: unknown };

const SUMMARY_OP_TO_FC: Record<string, string> = {
  ne: '$ne', gt: '$gt', lt: '$lt', gte: '$gte', lte: '$lte',
  contains: '$contains', in: '$in', notIn: '$nin',
};
const FC_TO_SUMMARY_OP: Record<string, string> = {
  $eq: 'eq', $ne: 'ne', $gt: 'gt', $lt: 'lt', $gte: 'gte', $lte: 'lte',
  $contains: 'contains', $in: 'in', $nin: 'notIn',
};
const SUMMARY_NUMERIC_TYPES = new Set(['number', 'currency', 'percent', 'rating', 'slider', 'autonumber']);

/** Coerce an editor string to the type the child field stores, so the emitted
 *  FilterCondition matches on the real column (a boolean, not the text "true"). */
function coerceSummaryValue(raw: unknown, fieldType: string | undefined, isList: boolean): unknown {
  const one = (s: unknown): unknown => {
    if (typeof s !== 'string') return s; // already typed (round-tripped from an existing filter)
    const t = s.trim();
    if (fieldType === 'boolean' || fieldType === 'toggle') return t === 'true' || t === '1';
    if (fieldType && SUMMARY_NUMERIC_TYPES.has(fieldType)) {
      const n = Number(t);
      return t !== '' && Number.isFinite(n) ? n : s;
    }
    return s;
  };
  if (isList) {
    const arr = Array.isArray(raw) ? raw : String(raw ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    return arr.map(one);
  }
  return one(raw);
}

/** FilterCondition object → editor rows. Understands the flat form and a
 *  top-level `$and` of flat conditions; anything else sets `advanced`. */
function summaryFilterToRows(filter: unknown): { rows: SummaryFilterRow[]; advanced: boolean } {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) return { rows: [], advanced: false };
  const rows: SummaryFilterRow[] = [];
  let advanced = false;
  const consume = (obj: Record<string, unknown>) => {
    for (const [key, v] of Object.entries(obj)) {
      if (key === '$and' && Array.isArray(v)) {
        for (const c of v) {
          if (c && typeof c === 'object' && !Array.isArray(c)) consume(c as Record<string, unknown>);
          else advanced = true;
        }
        continue;
      }
      if (key.startsWith('$')) { advanced = true; continue; } // $or / $not / unknown
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const entries = Object.entries(v as Record<string, unknown>);
        if (entries.length === 0) { advanced = true; continue; }
        for (const [op, val] of entries) {
          const sop = FC_TO_SUMMARY_OP[op];
          if (sop) rows.push({ field: key, operator: sop, value: val });
          else advanced = true;
        }
      } else {
        rows.push({ field: key, operator: 'eq', value: v }); // scalar/array ⇒ implicit equality
      }
    }
  };
  consume(filter as Record<string, unknown>);
  return { rows, advanced };
}

/** Editor rows → FilterCondition object. Drops field-less rows; merges into a
 *  flat object when field keys are distinct, else wraps in `$and`. */
function summaryRowsToFilter(
  rows: SummaryFilterRow[],
  typeOf: (field: string) => string | undefined,
): Record<string, unknown> | undefined {
  const valid = rows.filter((r) => r.field);
  if (valid.length === 0) return undefined;
  const conds = valid.map((r) => {
    const isList = r.operator === 'in' || r.operator === 'notIn';
    const cv = coerceSummaryValue(r.value, typeOf(r.field), isList);
    return r.operator === 'eq' ? { [r.field]: cv } : { [r.field]: { [SUMMARY_OP_TO_FC[r.operator] ?? '$eq']: cv } };
  });
  if (conds.length === 1) return conds[0];
  const keys = conds.map((c) => Object.keys(c)[0]);
  return new Set(keys).size === keys.length ? Object.assign({}, ...conds) : { $and: conds };
}

const summaryValueToText = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v));

/**
 * Structured editor for a `summary` field's roll-up definition. A summary
 * field has NO CEL expression — the spec models it as `summaryOperations`
 * ({object, field, function, relationshipField}) and the engine recomputes
 * the value when child records change. This replaces the formula textarea
 * that previously edited a `formula` key the runtime never read for either
 * computed type.
 */
function SummaryConfigFields({
  def,
  patchDef,
  objectOptions,
  readOnly,
  locale,
}: {
  def: Record<string, unknown>;
  patchDef: (patch: Record<string, unknown>) => void;
  objectOptions: Array<{ value: string; label: string }>;
  readOnly?: boolean;
  locale?: string;
}) {
  const tr = (key: string) => t(key, locale);
  const ops = readSummaryOps(def);
  const childObject = typeof ops.object === 'string' ? ops.object : '';
  const fn = typeof ops.function === 'string' ? ops.function : '';
  const { fields: childFields, loading } = useObjectFields(childObject || undefined);

  const patchOps = (patch: Partial<SummaryOps>) => {
    const next: Record<string, unknown> = { ...ops, ...patch };
    for (const k of Object.keys(next)) {
      if (next[k] === undefined || next[k] === '') delete next[k];
    }
    patchDef({ summaryOperations: Object.keys(next).length > 0 ? next : undefined });
  };

  const aggregateOptions: InspectorComboOption[] = React.useMemo(
    () => childFields.filter((f) => !f.hidden).map((f) => ({ value: f.name, label: f.label, hint: f.type })),
    [childFields],
  );
  // The FK back to this parent lives on a child relation field.
  const relationshipOptions: InspectorComboOption[] = React.useMemo(
    () =>
      childFields
        .filter((f) => f.type === 'lookup' || f.type === 'master_detail')
        .map((f) => ({ value: f.name, label: f.label, hint: f.type })),
    [childFields],
  );
  const fieldPlaceholder = childObject
    ? tr('designer.field.lookup.selectField')
    : tr('designer.field.summary.setObjectFirst');

  // Filter editor: derive rows from the FilterCondition each render, edit, and
  // serialize back. `typeOf` coerces values to the child field's stored type.
  const typeOf = React.useCallback(
    (name: string) => childFields.find((f) => f.name === name)?.type,
    [childFields],
  );
  const { rows: filterRows, advanced: filterAdvanced } = summaryFilterToRows(ops.filter);
  const commitFilterRows = (rows: SummaryFilterRow[]) => patchOps({ filter: summaryRowsToFilter(rows, typeOf) });
  const patchFilterRow = (i: number, patch: Partial<SummaryFilterRow>) =>
    commitFilterRows(filterRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addFilterRow = () =>
    commitFilterRows([...filterRows, { field: aggregateOptions[0]?.value ?? '', operator: 'eq', value: '' }]);
  const removeFilterRow = (i: number) => commitFilterRows(filterRows.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <ObjectPicker
        label={tr('designer.field.summary.object')}
        value={childObject}
        options={objectOptions}
        onCommit={(v) => patchOps({ object: v || undefined })}
        disabled={readOnly}
        placeholder={tr('designer.field.objectNamePlaceholder')}
      />
      <InspectorSelectField
        label={tr('designer.field.summary.function')}
        value={fn}
        options={[
          { value: '', label: tr('designer.field.defaultNone') },
          ...SUMMARY_FUNCTIONS.map((f) => ({ value: f, label: tr(`designer.field.summary.fn.${f}`) })),
        ]}
        onCommit={(v) => patchOps({ function: v || undefined })}
        disabled={readOnly}
      />
      {/* The spec requires `field` even for `count` (documented as ignored),
          so it stays visible — hiding it would trap the author with an
          unfixable "required" issue in the draft banner. */}
      <InspectorComboField
        label={tr('designer.field.summary.field')}
        value={typeof ops.field === 'string' ? ops.field : ''}
        onCommit={(v) => patchOps({ field: v || undefined })}
        options={aggregateOptions}
        loading={loading}
        placeholder={fieldPlaceholder}
        searchPlaceholder={tr('designer.field.lookup.searchFields')}
        disabled={readOnly}
        mono
      />
      {fn === 'count' && (
        <p className="text-[11px] text-muted-foreground/70 px-0.5 -mt-1">
          {tr('designer.field.summary.countFieldHint')}
        </p>
      )}
      <InspectorComboField
        label={tr('designer.field.summary.relationshipField')}
        value={typeof ops.relationshipField === 'string' ? ops.relationshipField : ''}
        onCommit={(v) => patchOps({ relationshipField: v || undefined })}
        options={relationshipOptions}
        loading={loading}
        placeholder={fieldPlaceholder}
        searchPlaceholder={tr('designer.field.lookup.searchFields')}
        disabled={readOnly}
        mono
      />

      {/* Optional filter — only child rows matching these conditions aggregate
          (framework#1868). Reads/writes summaryOperations.filter as a
          FilterCondition; rows mirror the lookupFilters editor. */}
      <div className="space-y-1.5 border-t pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground">{tr('designer.field.summary.filterSection')}</Label>
            {!filterAdvanced && <Badge variant="outline" className="text-[10px]">{filterRows.length}</Badge>}
          </div>
          {!readOnly && !filterAdvanced && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-1.5 text-[11px]"
              onClick={addFilterRow}
              disabled={aggregateOptions.length === 0}
            >
              <Plus className="h-3 w-3" /> {tr('designer.field.summary.addFilter')}
            </Button>
          )}
        </div>
        {filterAdvanced ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
            {tr('designer.field.summary.filterAdvanced')}
          </p>
        ) : filterRows.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground">
            {tr('designer.field.summary.noFilter')}
          </p>
        ) : (
          filterRows.map((f, i) => (
            <div key={i} className="rounded-md border p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{tFormat('designer.field.lookup.filterN', locale, { n: i + 1 })}</span>
                {!readOnly && (
                  <Button type="button" variant="ghost" size="sm" aria-label={tr('designer.field.lookup.removeFilter')} className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeFilterRow(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <InspectorComboField
                label={tr('designer.field.lookup.filterField')}
                value={f.field ?? ''}
                onCommit={(v) => patchFilterRow(i, { field: v })}
                options={aggregateOptions}
                loading={loading}
                placeholder={fieldPlaceholder}
                searchPlaceholder={tr('designer.field.lookup.searchFields')}
                disabled={readOnly}
                mono
              />
              <InspectorSelectField label={tr('designer.field.lookup.filterOperator')} value={f.operator ?? 'eq'} options={LOOKUP_OPERATORS} onCommit={(v) => patchFilterRow(i, { operator: v })} disabled={readOnly} />
              <InspectorTextField
                label={tr('designer.field.lookup.filterValue')}
                value={summaryValueToText(f.value)}
                onCommit={(v) => patchFilterRow(i, { value: v })}
                placeholder={f.operator === 'in' || f.operator === 'notIn' ? 'comma,separated,values' : 'value'}
                disabled={readOnly}
                mono
              />
            </div>
          ))
        )}
        <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-snug">
          {tr('designer.field.summary.filterHint')}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-snug">
        {tr('designer.field.summary.hint')}
      </p>
    </div>
  );
}

/* ─────────────── Hook: load object list for lookup picker ─────────────── */

function useObjectOptions(): Array<{ value: string; label: string }> {
  const client: MetadataClient = useMetadataClient();
  const [opts, setOpts] = React.useState<Array<{ value: string; label: string }>>([]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      client.list<{ name?: string; label?: string }>('object'),
      // Draft objects are not yet published, so `list('object')` can't see
      // them. Include them so a lookup can target a SIBLING object being
      // designed in the same authoring pass (before the package's first
      // publish) instead of forcing the author to type an API name blind.
      client.listDrafts({ type: 'object' }).catch(() => [] as Array<{ name?: string }>),
    ])
      .then(([published, drafts]) => {
        if (cancelled) return;
        const byName = new Map<string, { value: string; label: string }>();
        for (const i of published ?? []) {
          if (typeof i?.name === 'string' && i.name && !byName.has(i.name)) {
            byName.set(i.name, {
              value: i.name,
              label: i.label ? `${i.label} (${i.name})` : i.name,
            });
          }
        }
        for (const d of drafts ?? []) {
          const name = (d as { name?: string }).name;
          if (typeof name === 'string' && name && !byName.has(name)) {
            byName.set(name, { value: name, label: `${name} (草稿)` });
          }
        }
        setOpts([...byName.values()].sort((a, b) => a.value.localeCompare(b.value)));
      })
      .catch(() => {
        // Empty list — picker falls back to free-text. No banner needed.
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return opts;
}
