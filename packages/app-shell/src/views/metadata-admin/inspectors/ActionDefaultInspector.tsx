// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ActionDefaultInspector — type-aware authoring panel for an Action.
 *
 * Replaces the flat, everything-at-once SchemaForm for `action` with a
 * progressively-disclosed editor organised around how an action is actually
 * designed (mirroring Salesforce Quick Actions / ServiceNow UI Actions):
 *
 *   1. Basics       — label / name / object scope / icon / variant
 *   2. Behavior     — type-FIRST, then only the fields that `type` needs
 *                     (script → body editor; api → method + endpoint;
 *                      url/flow/modal/form → a single target binding)
 *   3. Inputs       — the params dialog the user fills before it runs
 *                     (field-backed picks reuse the object's field metadata)
 *   4. Placement    — where the button surfaces + object-vs-global scope hint
 *   5. Feedback     — confirm / success / error / refresh / undo / mode
 *   6. Conditions   — visible / disabled CEL predicates
 *   7. AI exposure  — opt-in tool exposure (ADR-0011)
 *
 * Rare/advanced props (resultDialog, bodyExtra, recordId mapping, new-tab,
 * timeout, aria, …) are NOT hand-curated here — they fall through to a
 * collapsed "More fields" SchemaForm fed the live server schema, with the
 * curated keys hidden so nothing is double-edited and nothing is lost.
 *
 * AI exposure uses the flattened `aiExposed` / `aiDescription` keys (the
 * objectui/server convention that ActionPreview reads), not the nested `ai`
 * block, so the curated control and the runtime/preview agree.
 */

import * as React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Button, Label, Textarea,
} from '@object-ui/components';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorCheckboxField,
  appendArray,
  moveArray,
  spliceArray,
} from './_shared';
import { useObjectOptions } from '../previews/useObjectOptions';
import { useObjectFields } from '../previews/useObjectFields';
import { ConditionBuilder } from './ConditionBuilder';
import { IconPickerWidget } from '../widgets';

/* ─────────────── constants ─────────────── */

const ACTION_TYPES = [
  { value: 'script', label: 'Script — run an expression / sandboxed JS' },
  { value: 'api', label: 'API — call an endpoint' },
  { value: 'flow', label: 'Flow — invoke a flow' },
  { value: 'modal', label: 'Modal — open a modal/page' },
  { value: 'form', label: 'Form — open a FormView' },
  { value: 'url', label: 'URL — navigate to a link' },
];

const VARIANT_OPTS = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'danger', label: 'Danger' },
  { value: 'ghost', label: 'Ghost' },
  { value: 'link', label: 'Link' },
];

const COMPONENT_OPTS = [
  { value: 'action:button', label: 'Button' },
  { value: 'action:icon', label: 'Icon only' },
  { value: 'action:menu', label: 'Menu item' },
  { value: 'action:group', label: 'Button group' },
];

const MODE_OPTS = [
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'custom', label: 'Custom' },
];

const METHOD_OPTS = [
  { value: 'POST', label: 'POST' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
];

const BODY_LANG_OPTS = [
  { value: 'expression', label: 'Expression (L1)' },
  { value: 'js', label: 'Sandboxed JS (L2)' },
];

const PARAM_TYPE_OPTS = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'Select' },
  { value: 'date', label: 'Date' },
  { value: 'datetime', label: 'Date/time' },
  { value: 'lookup', label: 'Lookup' },
];

/** Canonical action locations (mirrors spec ACTION_LOCATIONS) with friendly labels. */
const LOCATIONS: Array<{ value: string; label: string }> = [
  { value: 'record_header', label: 'Record header' },
  { value: 'record_more', label: 'Record · more menu' },
  { value: 'record_section', label: 'Record · section' },
  { value: 'record_related', label: 'Record · related list' },
  { value: 'list_toolbar', label: 'List toolbar' },
  { value: 'list_item', label: 'List · row' },
  { value: 'global_nav', label: 'Global nav / command palette' },
];

/** Per-type binding hints for the single `target` field. */
const TARGET_FIELD: Record<string, { label: string; placeholder: string; hint: string }> = {
  url: { label: 'URL', placeholder: 'https://… or /path?x=${param.x}', hint: 'Supports ${param.x} and ${ctx.x} interpolation.' },
  flow: { label: 'Flow name', placeholder: 'snake_case flow', hint: 'The flow to invoke when clicked.' },
  modal: { label: 'Modal / page name', placeholder: 'snake_case page', hint: 'The modal or page to open.' },
  form: { label: 'Form view name', placeholder: 'object.viewKey', hint: 'Opens /console/forms/<name>.' },
  api: { label: 'API endpoint', placeholder: '/api/v1/…', hint: 'Endpoint called with the request body below.' },
};

/** Keys this inspector edits with its own controls — hidden from the fallback. */
const CURATED_FIELDS = [
  'name', 'label', 'objectName', 'icon', 'variant', 'component',
  'type', 'target', 'execute', 'body', 'method',
  'params', 'locations', 'bulkEnabled',
  'confirmText', 'successMessage', 'errorMessage', 'refreshAfter', 'undoable', 'mode', 'shortcut',
  'visible', 'disabled', 'aiExposed', 'aiDescription',
];

/* ─────────────── small helpers ─────────────── */

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {hint && <div className="text-[11px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

function localize(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, string>;
    return o.en ?? o['en-US'] ?? Object.values(o)[0] ?? '';
  }
  return String(v);
}

/** Object dropdown (falls back to free text when no objects are resolvable). */
function ObjectPicker({ label, value, onCommit, disabled, hint }: {
  label: string; value: string | undefined; onCommit: (v: string) => void; disabled?: boolean; hint?: string;
}) {
  const { options } = useObjectOptions();
  return (
    <div className="space-y-1">
      {options.length === 0 ? (
        <InspectorTextField label={label} value={value ?? ''} placeholder="snake_case object" onCommit={onCommit} disabled={disabled} mono />
      ) : (
        <InspectorSelectField label={label} value={value || undefined} options={[{ value: '', label: '— None (global) —' }, ...options]} onCommit={onCommit} disabled={disabled} />
      )}
      {hint && <div className="text-[11px] text-muted-foreground/70">{hint}</div>}
    </div>
  );
}

/** Field dropdown bound to an object (free text when unresolved). */
function FieldPicker({ label, objectName, value, onCommit, disabled }: {
  label: string; objectName: string | undefined; value: string | undefined; onCommit: (v: string) => void; disabled?: boolean;
}) {
  const { fields } = useObjectFields(objectName);
  const options = React.useMemo(
    () => fields.filter((f) => !f.hidden).map((f) => ({ value: f.name, label: f.label && f.label !== f.name ? `${f.label} (${f.name})` : f.name })),
    [fields],
  );
  if (!objectName || options.length === 0) {
    return <InspectorTextField label={label} value={value ?? ''} onCommit={onCommit} disabled={disabled} mono />;
  }
  return <InspectorSelectField label={label} value={value || undefined} options={[{ value: '', label: '—' }, ...options]} onCommit={onCommit} disabled={disabled} />;
}

interface ActionParam {
  name?: string;
  field?: string;
  label?: unknown;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultFromRow?: boolean;
  [k: string]: unknown;
}

/* ─────────────── inspector ─────────────── */

export function ActionDefaultInspector({
  draft,
  onPatch,
  readOnly,
  locale,
  serverSchema,
}: MetadataDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);

  const str = (k: string): string => (typeof draft[k] === 'string' ? (draft[k] as string) : '');
  const type = str('type') || 'script';
  const objectName = str('objectName');
  const body = (draft.body && typeof draft.body === 'object' ? draft.body : {}) as Record<string, unknown>;
  const params: ActionParam[] = Array.isArray(draft.params) ? (draft.params as ActionParam[]) : [];
  const locations: string[] = Array.isArray(draft.locations) ? (draft.locations as string[]) : [];

  // AI exposure — flattened keys (objectui/server convention, read by ActionPreview).
  const aiExposed = draft.aiExposed === true;
  const aiDescription = typeof draft.aiDescription === 'string' ? (draft.aiDescription as string) : '';

  const patchBody = (p: Record<string, unknown>) => onPatch({ body: { ...body, ...p } });
  const patchParam = (i: number, p: Partial<ActionParam>) =>
    onPatch({ params: params.map((it, j) => (j === i ? { ...it, ...p } : it)) });

  const toggleLocation = (loc: string, on: boolean) => {
    const next = on ? [...new Set([...locations, loc])] : locations.filter((l) => l !== loc);
    onPatch({ locations: next });
  };

  const targetCfg = TARGET_FIELD[type];

  const fallbackSchema = serverSchema as Record<string, unknown> | undefined;

  return (
    <InspectorShell
      kindLabel={tr('engine.inspector.action.kind')}
      title={String(localize(draft.label) || draft.name || tr('engine.inspector.action.kind'))}
      onClose={() => {}}
      closeLabel={tr('engine.inspector.action.close')}
      hideClose
    >
      {/* 1 ─ Basics */}
      <SectionHeader title="Basics" />
      <InspectorTextField label="Label" value={localize(draft.label)} onCommit={(v) => onPatch({ label: v })} placeholder="Button text shown to users" disabled={readOnly} />
      <InspectorTextField label="Name" value={str('name')} onCommit={(v) => onPatch({ name: v })} placeholder="snake_case identifier" disabled={readOnly} mono />
      <ObjectPicker
        label="Object"
        value={objectName}
        onCommit={(v) => onPatch({ objectName: v || undefined })}
        disabled={readOnly}
        hint={objectName ? 'Bound action — surfaces in this object’s views per the placement below.' : 'Empty = global action — must be referenced by a page’s quick actions, global nav, a flow, or AI to appear.'}
      />
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Icon</Label>
          <IconPickerWidget schema={{ type: 'string' }} value={str('icon')} onChange={(v) => onPatch({ icon: (v as string) || undefined })} readOnly={readOnly} />
        </div>
        <InspectorSelectField label="Variant" value={str('variant') || undefined} options={VARIANT_OPTS} onCommit={(v) => onPatch({ variant: v })} disabled={readOnly} />
      </div>

      {/* 2 ─ Behavior (type-first) */}
      <div className="border-t pt-3 space-y-3">
        <SectionHeader title="Behavior" hint="What happens when the action is triggered." />
        <InspectorSelectField label="Type" value={type} options={ACTION_TYPES} onCommit={(v) => onPatch({ type: v })} disabled={readOnly} />

        {type === 'script' ? (
          <>
            <InspectorSelectField
              label="Script language"
              value={(typeof body.language === 'string' ? body.language : undefined) || 'expression'}
              options={BODY_LANG_OPTS}
              onCommit={(v) => patchBody({ language: v })}
              disabled={readOnly}
            />
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Script body</Label>
              <Textarea
                value={typeof body.source === 'string' ? (body.source as string) : ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => patchBody({ source: e.target.value })}
                disabled={readOnly}
                spellCheck={false}
                rows={5}
                placeholder={'// (input, ctx) => result\nreturn { ok: true }'}
                className="text-xs font-mono"
              />
              <div className="text-[11px] text-muted-foreground/70">Runs in the sandbox as <code>(input, ctx) =&gt; Promise&lt;output&gt;</code>.</div>
            </div>
          </>
        ) : (
          <>
            {type === 'api' && (
              <InspectorSelectField label="Method" value={str('method') || 'POST'} options={METHOD_OPTS} onCommit={(v) => onPatch({ method: v })} disabled={readOnly} />
            )}
            {targetCfg && (
              <div className="space-y-1">
                <InspectorTextField label={`${targetCfg.label} *`} value={str('target')} onCommit={(v) => onPatch({ target: v })} placeholder={targetCfg.placeholder} disabled={readOnly} mono />
                <div className="text-[11px] text-muted-foreground/70">{targetCfg.hint}</div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3 ─ Inputs (params) */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader title="Inputs" hint="Collected from the user in a dialog before the action runs." />
        {params.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2.5 text-center text-[11px] text-muted-foreground">No inputs — the action runs immediately on click.</p>
        ) : (
          params.map((p, i) => (
            <div key={i} className="space-y-2 rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">#{i + 1}</span>
                <div className="flex items-center gap-0.5">
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={readOnly || i === 0} aria-label="Move up" onClick={() => onPatch({ params: moveArray(params, i, i - 1) })}>↑</Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={readOnly || i === params.length - 1} aria-label="Move down" onClick={() => onPatch({ params: moveArray(params, i, i + 1) })}>↓</Button>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6" disabled={readOnly} aria-label="Remove input" onClick={() => onPatch({ params: spliceArray(params, i, null) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              {objectName ? (
                <FieldPicker label="Bind to field" objectName={objectName} value={p.field} onCommit={(v) => patchParam(i, { field: v || undefined })} disabled={readOnly} />
              ) : null}
              {!p.field && (
                <InspectorTextField label="Name" value={p.name ?? ''} onCommit={(v) => patchParam(i, { name: v })} placeholder="request-body key" disabled={readOnly} mono />
              )}
              <InspectorTextField label="Label" value={localize(p.label)} onCommit={(v) => patchParam(i, { label: v })} disabled={readOnly} />
              {!p.field && (
                <InspectorSelectField label="Type" value={p.type || undefined} options={PARAM_TYPE_OPTS} onCommit={(v) => patchParam(i, { type: v })} disabled={readOnly} />
              )}
              <InspectorTextField label="Placeholder" value={p.placeholder ?? ''} onCommit={(v) => patchParam(i, { placeholder: v })} disabled={readOnly} />
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <InspectorCheckboxField label="Required" value={!!p.required} onCommit={(v) => patchParam(i, { required: v })} disabled={readOnly} />
                <InspectorCheckboxField label="Pre-fill from row" value={!!p.defaultFromRow} onCommit={(v) => patchParam(i, { defaultFromRow: v })} disabled={readOnly} />
              </div>
            </div>
          ))
        )}
        {!readOnly && (
          <Button type="button" variant="outline" size="sm" onClick={() => onPatch({ params: appendArray(params, {} as ActionParam) })}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add input
          </Button>
        )}
      </div>

      {/* 4 ─ Placement & scope */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader title="Placement" hint="Where this action surfaces in the UI." />
        <div className="grid grid-cols-1 gap-1">
          {LOCATIONS.map((loc) => (
            <InspectorCheckboxField key={loc.value} label={loc.label} value={locations.includes(loc.value)} onCommit={(v) => toggleLocation(loc.value, v)} disabled={readOnly} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <InspectorSelectField label="Component" value={str('component') || undefined} options={COMPONENT_OPTS} onCommit={(v) => onPatch({ component: v })} disabled={readOnly} />
        </div>
        <InspectorCheckboxField label="Bulk — apply to multiple selected rows" value={!!draft.bulkEnabled} onCommit={(v) => onPatch({ bulkEnabled: v })} disabled={readOnly} />
      </div>

      {/* 5 ─ Feedback */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader title="Feedback" hint="Confirmation and post-run messaging." />
        <InspectorTextField label="Confirm prompt" value={localize(draft.confirmText)} onCommit={(v) => onPatch({ confirmText: v })} placeholder="Ask before running (leave blank to skip)" disabled={readOnly} />
        <InspectorTextField label="Success message" value={localize(draft.successMessage)} onCommit={(v) => onPatch({ successMessage: v })} disabled={readOnly} />
        <InspectorTextField label="Error message" value={localize(draft.errorMessage)} onCommit={(v) => onPatch({ errorMessage: v })} disabled={readOnly} />
        <div className="grid grid-cols-2 gap-2">
          <InspectorSelectField label="Mode" value={str('mode') || undefined} options={MODE_OPTS} onCommit={(v) => onPatch({ mode: v })} disabled={readOnly} />
          <InspectorTextField label="Shortcut" value={str('shortcut')} onCommit={(v) => onPatch({ shortcut: v })} placeholder="e.g. Ctrl+S" disabled={readOnly} mono />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <InspectorCheckboxField label="Refresh view after" value={!!draft.refreshAfter} onCommit={(v) => onPatch({ refreshAfter: v })} disabled={readOnly} />
          <InspectorCheckboxField label="Offer undo" value={!!draft.undoable} onCommit={(v) => onPatch({ undoable: v })} disabled={readOnly} />
        </div>
      </div>

      {/* 6 ─ Conditions */}
      <div className="border-t pt-3 space-y-3">
        <SectionHeader title="Conditions" hint="No-code predicates over the record / user / ctx (compiled to CEL)." />
        <ConditionBuilder label="Visible when" value={typeof draft.visible === 'string' ? (draft.visible as string) : ''} onCommit={(v) => onPatch({ visible: v || undefined })} objectName={objectName} disabled={readOnly} />
        <ConditionBuilder label="Disabled when" value={typeof draft.disabled === 'string' ? (draft.disabled as string) : ''} onCommit={(v) => onPatch({ disabled: v || undefined })} objectName={objectName} disabled={readOnly} />
      </div>

      {/* 7 ─ AI exposure */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader title="AI exposure" hint="Opt-in: expose this action to AI agents as a callable tool." />
        <InspectorCheckboxField label="Expose to AI agents" value={aiExposed} onCommit={(v) => onPatch({ aiExposed: v })} disabled={readOnly} />
        {aiExposed ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tool description (required, ≥40 chars)</Label>
            <Textarea
              value={aiDescription}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onPatch({ aiDescription: e.target.value })}
              disabled={readOnly}
              rows={3}
              placeholder="When and why an agent should call this action…"
              className="text-xs"
            />
            {aiDescription.length < 40 && (
              <div className="text-[11px] text-destructive">A ≥40-character description is required while exposed.</div>
            )}
          </div>
        ) : null}
      </div>

      {/* Advanced — everything not curated above, from the live schema */}
      {fallbackSchema && (
        <div className="border-t pt-3 space-y-1.5">
          <SectionHeader title={tr('engine.inspector.moreFields')} hint="Advanced / rarely-used properties." />
          <SchemaForm
            schema={fallbackSchema}
            value={draft}
            hiddenFields={CURATED_FIELDS}
            readOnly={readOnly}
            onChange={(next) => onPatch(next)}
          />
        </div>
      )}
    </InspectorShell>
  );
}
