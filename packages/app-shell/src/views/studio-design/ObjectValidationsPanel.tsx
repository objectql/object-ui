/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — Validations view.
 *
 * Edits `ObjectSchema.validations` (spec `ValidationRuleSchema`, a discriminated
 * union on `type`). Every rule type in the spec is authorable here — not just
 * `script` — so the no-code surface is a faithful config panel for the metadata:
 *
 *   - script        — a CEL FAIL predicate (TRUE ⇒ the write is rejected).
 *   - cross_field   — a CEL predicate plus the participating fields.
 *   - state_machine — a status field + allowed from→to transitions.
 *   - format        — a field + a built-in format or a regex pattern.
 *   - json_schema   — a JSON field validated against a JSON Schema.
 *   - conditional   — a CEL guard + a nested rule applied when it holds.
 *
 * Adding a rule offers every type (the "New" menu), each seeded with a VALID
 * skeleton so the immediate object-draft save never 422s. The common fields
 * (name / label / message / severity / events / priority / active) are shared
 * by all types; the type-specific fields render below them. CEL conditions
 * reuse the metadata-admin `ConditionBuilder`, fed the DRAFT field list so
 * unpublished fields are pickable.
 *
 * Persistence: like actions, validations live ON the object draft — this panel
 * calls `onPatch({ validations })` and the Data pillar's Save draft owns the
 * write. Nothing here fetches or saves on its own.
 */

import React from 'react';
import { Plus, Trash2, ShieldAlert, ChevronDown } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@object-ui/components';
import { ConditionBuilder } from '../metadata-admin/inspectors/ConditionBuilder';
import { readFields } from '../metadata-admin/previews/object-fields-io';
import { t, useMetadataLocale } from '../metadata-admin/i18n';

type RuleType = 'script' | 'cross_field' | 'state_machine' | 'format' | 'json_schema' | 'conditional';

interface ValidationRuleDraft {
  type?: string;
  name?: string;
  label?: string;
  description?: string;
  message?: string;
  condition?: string;
  severity?: 'error' | 'warning' | 'info';
  active?: boolean;
  events?: string[];
  priority?: number;
  // type-specific
  field?: string;
  fields?: string[];
  regex?: string;
  format?: string;
  transitions?: Record<string, string[]>;
  schema?: Record<string, unknown>;
  then?: unknown;
  otherwise?: unknown;
  [key: string]: unknown;
}

interface FieldOpt {
  name: string;
  label?: string;
  hidden?: boolean;
}

/** Rule types, in menu order. `json_schema` matches the spec literal (not `json`). */
const RULE_TYPES: ReadonlyArray<{ value: RuleType; labelKey: string }> = [
  { value: 'script', labelKey: 'engine.studio.rules.typeScript' },
  { value: 'cross_field', labelKey: 'engine.studio.rules.typeCrossField' },
  { value: 'state_machine', labelKey: 'engine.studio.rules.typeStateMachine' },
  { value: 'format', labelKey: 'engine.studio.rules.typeFormat' },
  { value: 'json_schema', labelKey: 'engine.studio.rules.typeJsonSchema' },
  { value: 'conditional', labelKey: 'engine.studio.rules.typeConditional' },
];

const EVENTS = ['insert', 'update', 'delete'] as const;
const BUILTIN_FORMATS = ['', 'url', 'email', 'phone', 'json'] as const;

function readRules(input: unknown): ValidationRuleDraft[] {
  if (!Array.isArray(input)) return [];
  return input.filter((r): r is ValidationRuleDraft => !!r && typeof r === 'object');
}

function nextRuleName(existing: string[]): string {
  let i = existing.length + 1;
  let name = `validation_${i}`;
  const taken = new Set(existing);
  while (taken.has(name)) name = `validation_${++i}`;
  return name;
}

/**
 * A VALID minimal skeleton for a rule of `type` — every required field is
 * present with a save-safe value. An empty `condition` is rejected by the
 * spec's ExpressionInputSchema, so CEL-bearing types default to `false` (a
 * never-firing no-op); required `field`/`fields` seed from the first field.
 */
function makeSkeleton(type: RuleType, name: string, firstField?: string): ValidationRuleDraft {
  const base = { name, message: '', severity: 'error' as const, active: true };
  switch (type) {
    case 'script':
      return { ...base, type, condition: 'false' };
    case 'cross_field':
      return { ...base, type, condition: 'false', fields: firstField ? [firstField] : [] };
    case 'state_machine':
      return { ...base, type, field: firstField ?? '', transitions: {} };
    case 'format':
      return { ...base, type, field: firstField ?? '' };
    case 'json_schema':
      return { ...base, type, field: firstField ?? '', schema: {} };
    case 'conditional':
      return {
        ...base,
        type,
        condition: 'false',
        then: { type: 'script', name: `${name}_then`, message: '', condition: 'false', severity: 'error' },
      };
  }
}

/** A JSON <textarea> that keeps invalid text local and only commits parsed objects. */
function JsonField({
  label,
  value,
  onCommit,
  disabled,
  locale,
}: {
  label: string;
  value: unknown;
  onCommit: (parsed: unknown) => void;
  disabled?: boolean;
  locale: string;
}) {
  const serialized = React.useMemo(() => {
    if (value == null) return '';
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '';
    }
  }, [value]);
  const [text, setText] = React.useState(serialized);
  const [err, setErr] = React.useState<string | null>(null);
  // Re-sync when the selected rule changes underneath us.
  React.useEffect(() => {
    setText(serialized);
    setErr(null);
  }, [serialized]);
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <textarea
        value={text}
        disabled={disabled}
        spellCheck={false}
        rows={5}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const raw = text.trim();
          if (!raw) {
            setErr(null);
            onCommit(undefined);
            return;
          }
          try {
            onCommit(JSON.parse(raw));
            setErr(null);
          } catch {
            setErr(t('engine.studio.rules.invalidJson', locale));
          }
        }}
        className="w-full rounded border bg-background px-2 py-1 font-mono text-[11px]"
      />
      {err && <span className="mt-1 block text-[11px] text-destructive">{err}</span>}
    </label>
  );
}

/** State-machine `transitions` editor: from-state → allowed next states (CSV). */
function TransitionsField({
  transitions,
  onCommit,
  disabled,
  locale,
}: {
  transitions: Record<string, string[]>;
  onCommit: (next: Record<string, string[]>) => void;
  disabled?: boolean;
  locale: string;
}) {
  const rows = Object.entries(transitions);
  const setRow = (idx: number, from: string, to: string[]) => {
    const next: Record<string, string[]> = {};
    rows.forEach(([k, v], i) => {
      if (i === idx) {
        if (from) next[from] = to;
      } else {
        next[k] = v;
      }
    });
    onCommit(next);
  };
  return (
    <div className="space-y-2">
      <span className="block text-[11px] text-muted-foreground">{t('engine.studio.rules.transitions', locale)}</span>
      {rows.map(([from, to], i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input
            value={from}
            disabled={disabled}
            placeholder={t('engine.studio.rules.transitionFrom', locale)}
            onChange={(e) => setRow(i, e.target.value, to)}
            className="w-32 rounded border bg-background px-2 py-1 text-[12px]"
          />
          <span className="text-muted-foreground">→</span>
          <input
            value={to.join(', ')}
            disabled={disabled}
            placeholder={t('engine.studio.rules.transitionTo', locale)}
            onChange={(e) =>
              setRow(i, from, e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
            }
            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-[12px]"
          />
          {!disabled && (
            <button
              type="button"
              aria-label={t('engine.studio.rules.delete', locale)}
              onClick={() => setRow(i, '', [])}
              className="rounded border border-destructive/40 p-1 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={() => onCommit({ ...transitions, '': [] })}
          disabled={'' in transitions}
          className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> {t('engine.studio.rules.addTransition', locale)}
        </button>
      )}
    </div>
  );
}

/** The type-specific fields for the selected rule (below the shared common fields). */
function RuleTypeFields({
  rule,
  fields,
  patch,
  disabled,
  locale,
}: {
  rule: ValidationRuleDraft;
  fields: FieldOpt[];
  patch: (p: Partial<ValidationRuleDraft>) => void;
  disabled?: boolean;
  locale: string;
}) {
  const fieldSelect = (label: string, value: string | undefined, onSet: (v: string) => void) => (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <select
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => onSet(e.target.value)}
        className="w-full rounded border bg-background px-2 py-1 text-[12px]"
      >
        <option value="">{t('engine.studio.rules.pickField', locale)}</option>
        {fields.map((f) => (
          <option key={f.name} value={f.name}>
            {f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name}
          </option>
        ))}
      </select>
    </label>
  );

  const conditionField = (
    <div>
      <span className="mb-1 block text-[11px] text-muted-foreground">
        {t('engine.studio.rules.celPre', locale)}
        <b>{t('engine.studio.rules.celTrue', locale)}</b>
        {t('engine.studio.rules.celMid', locale)}
        <code className="rounded bg-muted px-1">false</code>
        {t('engine.studio.rules.celPost', locale)}
      </span>
      <ConditionBuilder
        value={typeof rule.condition === 'string' ? rule.condition : ''}
        onCommit={(cel) => patch({ condition: cel })}
        fields={fields}
        disabled={disabled}
      />
    </div>
  );

  switch (rule.type) {
    case 'script':
      return conditionField;
    case 'cross_field': {
      const selected = Array.isArray(rule.fields) ? rule.fields : [];
      const toggle = (name: string, on: boolean) =>
        patch({ fields: on ? [...new Set([...selected, name])] : selected.filter((f) => f !== name) });
      return (
        <>
          {conditionField}
          <div>
            <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.fields', locale)}</span>
            <div className="flex flex-wrap gap-2 rounded border p-2">
              {fields.length === 0 && (
                <span className="text-[11px] text-muted-foreground">{t('engine.studio.rules.noFields', locale)}</span>
              )}
              {fields.map((f) => (
                <label key={f.name} className="flex items-center gap-1 text-[12px]">
                  <input
                    type="checkbox"
                    checked={selected.includes(f.name)}
                    disabled={disabled}
                    onChange={(e) => toggle(f.name, e.target.checked)}
                  />
                  {f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name}
                </label>
              ))}
            </div>
          </div>
        </>
      );
    }
    case 'state_machine':
      return (
        <>
          {fieldSelect(t('engine.studio.rules.statusField', locale), rule.field, (v) => patch({ field: v }))}
          <TransitionsField
            transitions={rule.transitions && typeof rule.transitions === 'object' ? rule.transitions : {}}
            onCommit={(next) => patch({ transitions: next })}
            disabled={disabled}
            locale={locale}
          />
        </>
      );
    case 'format':
      return (
        <>
          {fieldSelect(t('engine.studio.rules.field', locale), rule.field, (v) => patch({ field: v }))}
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.format', locale)}</span>
            <select
              value={typeof rule.format === 'string' ? rule.format : ''}
              disabled={disabled}
              onChange={(e) => patch({ format: e.target.value || undefined })}
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              {BUILTIN_FORMATS.map((f) => (
                <option key={f || 'none'} value={f}>
                  {f || t('engine.studio.rules.formatNone', locale)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.regex', locale)}</span>
            <input
              value={typeof rule.regex === 'string' ? rule.regex : ''}
              disabled={disabled}
              placeholder="^[A-Z]{2}\\d{4}$"
              onChange={(e) => patch({ regex: e.target.value || undefined })}
              className="w-full rounded border bg-background px-2 py-1 font-mono text-[12px]"
            />
          </label>
        </>
      );
    case 'json_schema':
      return (
        <>
          {fieldSelect(t('engine.studio.rules.field', locale), rule.field, (v) => patch({ field: v }))}
          <JsonField
            label={t('engine.studio.rules.jsonSchema', locale)}
            value={rule.schema}
            onCommit={(parsed) => patch({ schema: (parsed as Record<string, unknown>) ?? {} })}
            disabled={disabled}
            locale={locale}
          />
        </>
      );
    case 'conditional':
      return (
        <>
          {conditionField}
          <JsonField
            label={t('engine.studio.rules.then', locale)}
            value={rule.then}
            onCommit={(parsed) => patch({ then: parsed })}
            disabled={disabled}
            locale={locale}
          />
          <JsonField
            label={t('engine.studio.rules.otherwise', locale)}
            value={rule.otherwise}
            onCommit={(parsed) => patch({ otherwise: parsed })}
            disabled={disabled}
            locale={locale}
          />
        </>
      );
    default:
      return null;
  }
}

export function ObjectValidationsPanel({
  draft,
  onPatch,
  disabled,
}: {
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
}) {
  const locale = useMetadataLocale();
  const rules = React.useMemo(() => readRules(draft.validations), [draft.validations]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  // Default to the first rule so the detail pane isn't a dead "pick one" empty
  // state whenever rules already exist. Falls back automatically when `selected`
  // no longer matches the current rule list (deleted, or the object switched).
  const effectiveSelected = rules.some((r) => r.name === selected) ? selected : (rules[0]?.name ?? null);

  const fields = React.useMemo<FieldOpt[]>(
    () =>
      readFields(draft.fields).entries.map((e) => ({
        name: e.name,
        label: typeof e.def.label === 'string' ? (e.def.label as string) : undefined,
        hidden: e.def.hidden === true,
      })),
    [draft.fields],
  );
  const firstField = fields.find((f) => !f.hidden)?.name ?? fields[0]?.name;

  const commit = (next: ValidationRuleDraft[]) => onPatch({ validations: next });

  const patchRule = (name: string, patch: Partial<ValidationRuleDraft>) =>
    commit(rules.map((r) => (r.name === name ? { ...r, ...patch } : r)));

  const addRule = (type: RuleType) => {
    const name = nextRuleName(rules.map((r) => r.name ?? ''));
    commit([...rules, makeSkeleton(type, name, firstField)]);
    setSelected(name);
  };

  const removeRule = (name: string) => {
    commit(rules.filter((r) => r.name !== name));
    if (selected === name) setSelected(null);
  };

  const sel = rules.find((r) => r.name === effectiveSelected) ?? null;
  const selType = (typeof sel?.type === 'string' ? sel.type : 'script') as RuleType;

  // Switching a rule's type REPLACES it with a fresh valid skeleton (so stale
  // type-specific keys — a state_machine's `transitions`, a format's `regex` —
  // don't linger on the new shape) while carrying the shared fields across.
  const changeType = (name: string, nextType: RuleType) => {
    const cur = rules.find((r) => r.name === name);
    if (!cur) return;
    const next = makeSkeleton(nextType, name, firstField);
    // carry a CEL condition across the types that share one
    if (
      (nextType === 'script' || nextType === 'cross_field' || nextType === 'conditional') &&
      typeof cur.condition === 'string'
    ) {
      next.condition = cur.condition;
    }
    for (const k of ['label', 'description', 'message', 'severity', 'active', 'events', 'priority'] as const) {
      if (cur[k] !== undefined) (next as Record<string, unknown>)[k] = cur[k];
    }
    commit(rules.map((r) => (r.name === name ? next : r)));
  };

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* rule list */}
      <div className="flex w-72 shrink-0 flex-col rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.rules.title', locale)}</span>
          <span className="text-[11px] text-muted-foreground">({rules.length})</span>
          {!disabled && (
            <Popover open={addOpen} onOpenChange={setAddOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
                >
                  <Plus className="h-3 w-3" /> {t('engine.studio.new', locale)}
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={4} className="w-56 p-1">
                <p className="px-2 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {t('engine.studio.rules.newType', locale)}
                </p>
                {RULE_TYPES.map((rt) => (
                  <button
                    key={rt.value}
                    type="button"
                    onClick={() => {
                      addRule(rt.value);
                      setAddOpen(false);
                    }}
                    className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-muted"
                  >
                    {t(rt.labelKey, locale)}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {rules.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] leading-5 text-muted-foreground">
              {t('engine.studio.rules.none', locale)}
              <br />
              {t('engine.studio.rules.explain', locale)}
            </p>
          ) : (
            rules.map((r) => (
              <button
                key={r.name}
                type="button"
                onClick={() => setSelected(r.name ?? null)}
                className={
                  'flex w-full items-start gap-2 border-b px-3 py-2 text-left text-[12px] ' +
                  (effectiveSelected === r.name ? 'bg-muted' : 'hover:bg-muted/50')
                }
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{r.label || r.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {r.message || t('engine.studio.rules.noMessage', locale)}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                  {r.type ?? 'script'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* rule editor */}
      <div className="flex min-w-0 flex-1 flex-col rounded-lg border">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            {t('engine.studio.rules.pick', locale)}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.type', locale)}</span>
              <select
                value={selType}
                disabled={disabled}
                onChange={(e) => changeType(sel.name!, e.target.value as RuleType)}
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              >
                {RULE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>
                    {t(rt.labelKey, locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.nameLabel', locale)}</span>
              <input
                value={sel.name ?? ''}
                disabled={disabled}
                onChange={(e) => {
                  const name = e.target.value;
                  patchRule(sel.name!, { name });
                  setSelected(name);
                }}
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.label', locale)}</span>
              <input
                value={sel.label ?? ''}
                disabled={disabled}
                onChange={(e) => patchRule(sel.name!, { label: e.target.value || undefined })}
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.messageLabel', locale)}</span>
              <input
                value={sel.message ?? ''}
                disabled={disabled}
                onChange={(e) => patchRule(sel.name!, { message: e.target.value })}
                placeholder={t('engine.studio.rules.messagePlaceholder', locale)}
                className="w-full rounded border bg-background px-2 py-1 text-[12px]"
              />
            </label>

            {/* type-specific configuration */}
            <RuleTypeFields
              rule={sel}
              fields={fields}
              patch={(p) => patchRule(sel.name!, p)}
              disabled={disabled}
              locale={locale}
            />

            {/* runs-on events */}
            <div>
              <span className="mb-1 block text-[11px] text-muted-foreground">{t('engine.studio.rules.events', locale)}</span>
              <div className="flex items-center gap-4">
                {EVENTS.map((ev) => {
                  const on = Array.isArray(sel.events) ? sel.events.includes(ev) : false;
                  return (
                    <label key={ev} className="flex items-center gap-1.5 text-[12px]">
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={(e) => {
                          const cur = Array.isArray(sel.events) ? sel.events : [];
                          const next = e.target.checked ? [...new Set([...cur, ev])] : cur.filter((x) => x !== ev);
                          patchRule(sel.name!, { events: next });
                        }}
                      />
                      {t(`engine.studio.rules.event.${ev}`, locale)}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[12px]">
                <span className="text-muted-foreground">{t('engine.studio.rules.severity', locale)}</span>
                <select
                  value={sel.severity ?? 'error'}
                  disabled={disabled}
                  onChange={(e) => patchRule(sel.name!, { severity: e.target.value as ValidationRuleDraft['severity'] })}
                  className="rounded border bg-background px-1.5 py-0.5 text-[12px]"
                >
                  <option value="error">{t('engine.studio.rules.severityError', locale)}</option>
                  <option value="warning">warning</option>
                  <option value="info">info</option>
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-[12px]">
                <span className="text-muted-foreground">{t('engine.studio.rules.priority', locale)}</span>
                <input
                  type="number"
                  value={typeof sel.priority === 'number' ? sel.priority : ''}
                  disabled={disabled}
                  onChange={(e) =>
                    patchRule(sel.name!, { priority: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                  className="w-20 rounded border bg-background px-1.5 py-0.5 text-[12px]"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[12px]">
                <input
                  type="checkbox"
                  checked={sel.active !== false}
                  disabled={disabled}
                  onChange={(e) => patchRule(sel.name!, { active: e.target.checked })}
                />
                {t('engine.studio.rules.enabled', locale)}
              </label>
              {!disabled && (
                <button
                  type="button"
                  data-testid="rule-delete"
                  onClick={() => removeRule(sel.name!)}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-1 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> {t('engine.studio.rules.delete', locale)}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
