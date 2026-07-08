// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * HookDefaultInspector — curated authoring panel for a database Hook.
 *
 * Replaces the flat, everything-at-once SchemaForm for `hook` with a panel
 * organised around how a hook is actually designed:
 *
 *   1. Basics    — label / name / which object(s) it fires on (a PICKER, not a
 *                  free-text box — the reason this exists)
 *   2. Events    — the lifecycle events it subscribes to (write + query)
 *   3. Function  — language (expression / sandboxed JS) + the handler body in a
 *                  DEDICATED code editor (the second reason this exists)
 *   4. Options   — priority / async / a CEL run condition
 *
 * Rare/advanced props (handler ref, js capabilities/timeout/memory, …) fall
 * through to a collapsed "More fields" SchemaForm fed the live server schema,
 * with the curated keys hidden so nothing is double-edited or lost.
 *
 * `object` is spec `string | string[]` (or `'*'` for every object). The picker
 * normalises to/from that: `'*'` ⇒ all, one selection ⇒ a string, many ⇒ an
 * array. Any already-selected object not in the live catalog is preserved as a
 * synthesized option so a value is never silently dropped.
 */

import * as React from 'react';
import { Label, Textarea } from '@object-ui/components';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { SchemaForm } from '../SchemaForm';
import { t } from '../i18n';
import {
  InspectorShell,
  InspectorTextField,
  InspectorSelectField,
  InspectorNumberField,
  InspectorCheckboxField,
} from './_shared';
import { useObjectOptions } from '../previews/useObjectOptions';
import { ConditionBuilder } from './ConditionBuilder';

/* ─────────────── constants ─────────────── */

const BODY_LANG_OPTS = [
  { value: 'expression', label: 'Expression (L1)' },
  { value: 'js', label: 'Sandboxed JS (L2)' },
];

/** Lifecycle events, grouped by the operation they hang off. */
const WRITE_EVENTS = [
  'beforeInsert', 'afterInsert',
  'beforeUpdate', 'afterUpdate',
  'beforeDelete', 'afterDelete',
  'beforeUpdateMany', 'afterUpdateMany',
  'beforeDeleteMany', 'afterDeleteMany',
];
const QUERY_EVENTS = [
  'beforeFind', 'afterFind',
  'beforeFindOne', 'afterFindOne',
  'beforeCount', 'afterCount',
  'beforeAggregate', 'afterAggregate',
];

const ALL_OBJECTS = '*';

/** Keys this inspector edits with its own controls — hidden from the fallback. */
const CURATED_FIELDS = [
  'name', 'label', 'object', 'events', 'body', 'priority', 'async', 'condition',
];

/* ─────────────── helpers ─────────────── */

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

/** Read the spec `object` (string | string[] | '*') into a selection set. */
function readObjects(value: unknown): { all: boolean; names: string[] } {
  if (value === ALL_OBJECTS) return { all: true, names: [] };
  if (typeof value === 'string') return { all: false, names: value ? [value] : [] };
  if (Array.isArray(value)) {
    const names = value.filter((v): v is string => typeof v === 'string' && v !== ALL_OBJECTS);
    return { all: value.includes(ALL_OBJECTS), names };
  }
  return { all: false, names: [] };
}

/** Write a selection set back to the narrowest valid spec shape. */
function writeObjects(all: boolean, names: string[]): string | string[] {
  if (all) return ALL_OBJECTS;
  if (names.length === 1) return names[0];
  return names;
}

/* ─────────────── inspector ─────────────── */

export function HookDefaultInspector({
  draft,
  onPatch,
  readOnly,
  locale,
  serverSchema,
}: MetadataDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);

  const str = (k: string): string => (typeof draft[k] === 'string' ? (draft[k] as string) : '');
  const body = (draft.body && typeof draft.body === 'object' ? draft.body : {}) as Record<string, unknown>;
  const events: string[] = Array.isArray(draft.events) ? (draft.events as string[]) : [];
  const { all: allObjects, names: objectNames } = readObjects(draft.object);

  const { options: objectOptions } = useObjectOptions();
  // Preserve any selected object missing from the live catalog (draft-only /
  // cross-package) so it is never dropped from the picker.
  const pickerOptions = React.useMemo(() => {
    const known = new Set(objectOptions.map((o) => o.value));
    const extra = objectNames
      .filter((n) => !known.has(n))
      .map((n) => ({ value: n, label: `${n} (not published)` }));
    return [...extra, ...objectOptions];
  }, [objectOptions, objectNames]);

  const patchBody = (p: Record<string, unknown>) => onPatch({ body: { ...body, ...p } });

  const toggleObject = (name: string, on: boolean) => {
    const next = on ? [...new Set([...objectNames, name])] : objectNames.filter((n) => n !== name);
    onPatch({ object: writeObjects(false, next) });
  };
  const toggleEvent = (ev: string, on: boolean) => {
    const next = on ? [...new Set([...events, ev])] : events.filter((e) => e !== ev);
    onPatch({ events: next });
  };

  // A single object → give ConditionBuilder its fields; '*' / multi → raw mode.
  const conditionObject = !allObjects && objectNames.length === 1 ? objectNames[0] : undefined;
  const language = typeof body.language === 'string' ? (body.language as string) : 'expression';
  const fallbackSchema = serverSchema as Record<string, unknown> | undefined;

  return (
    <InspectorShell
      kindLabel={tr('engine.inspector.hook.kind')}
      title={String(localize(draft.label) || draft.name || tr('engine.inspector.hook.kind'))}
      onClose={() => {}}
      closeLabel={tr('engine.inspector.action.close')}
      hideClose
    >
      {/* 1 ─ Basics */}
      <SectionHeader title="Basics" />
      <InspectorTextField label="Label" value={localize(draft.label)} onCommit={(v) => onPatch({ label: v || undefined })} placeholder="Human-readable name" disabled={readOnly} />
      <InspectorTextField label="Name" value={str('name')} onCommit={(v) => onPatch({ name: v })} placeholder="snake_case identifier" disabled={readOnly} mono testId="hook-name" />

      <div className="space-y-1.5" data-testid="hook-object-picker">
        <Label className="text-xs text-muted-foreground">Object(s) this hook fires on</Label>
        <InspectorCheckboxField
          label="All objects (*)"
          value={allObjects}
          onCommit={(on) => onPatch({ object: on ? ALL_OBJECTS : writeObjects(false, objectNames) })}
          disabled={readOnly}
        />
        {!allObjects && (
          <div className="max-h-40 space-y-1 overflow-auto rounded-md border p-2">
            {pickerOptions.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No objects found — publish an object, then pick it here.</p>
            ) : (
              pickerOptions.map((o) => (
                <InspectorCheckboxField
                  key={o.value}
                  label={o.label}
                  value={objectNames.includes(o.value)}
                  onCommit={(on) => toggleObject(o.value, on)}
                  disabled={readOnly}
                />
              ))
            )}
          </div>
        )}
        {!allObjects && objectNames.length === 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">Pick at least one object (or All objects).</p>
        )}
      </div>

      {/* 2 ─ Events */}
      <div className="border-t pt-3 space-y-2">
        <SectionHeader title="Events" hint="Which lifecycle events invoke this hook." />
        <div className="text-[11px] font-medium text-muted-foreground/80">Write</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {WRITE_EVENTS.map((ev) => (
            <InspectorCheckboxField key={ev} label={ev} value={events.includes(ev)} onCommit={(on) => toggleEvent(ev, on)} disabled={readOnly} />
          ))}
        </div>
        <div className="pt-1 text-[11px] font-medium text-muted-foreground/80">Query</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {QUERY_EVENTS.map((ev) => (
            <InspectorCheckboxField key={ev} label={ev} value={events.includes(ev)} onCommit={(on) => toggleEvent(ev, on)} disabled={readOnly} />
          ))}
        </div>
        {events.length === 0 && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">Select at least one event.</p>
        )}
      </div>

      {/* 3 ─ Function */}
      <div className="border-t pt-3 space-y-3">
        <SectionHeader title="Function" hint="The handler that runs when the hook fires." />
        <InspectorSelectField
          label="Language"
          value={language}
          options={BODY_LANG_OPTS}
          onCommit={(v) => patchBody({ language: v })}
          disabled={readOnly}
        />
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Handler body</Label>
          <Textarea
            data-testid="hook-body-source"
            value={typeof body.source === 'string' ? (body.source as string) : ''}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => patchBody({ source: e.target.value })}
            disabled={readOnly}
            spellCheck={false}
            rows={8}
            placeholder={language === 'expression' ? 'record.amount >= 0' : '// (ctx) => { ... }\nreturn;'}
            className="text-xs font-mono"
          />
          <div className="text-[11px] text-muted-foreground/70">
            {language === 'expression'
              ? 'A single L1 expression evaluated against the record / ctx.'
              : 'Runs in the sandbox as (ctx) => Promise<void>.'}
          </div>
        </div>
      </div>

      {/* 4 ─ Options */}
      <div className="border-t pt-3 space-y-3">
        <SectionHeader title="Options" />
        <div className="grid grid-cols-2 gap-3">
          <InspectorNumberField label="Priority" value={typeof draft.priority === 'number' ? (draft.priority as number) : undefined} onCommit={(v) => onPatch({ priority: v })} placeholder="100" disabled={readOnly} />
          <div className="flex items-end pb-1.5">
            <InspectorCheckboxField label="Run asynchronously (after commit)" value={draft.async === true} onCommit={(v) => onPatch({ async: v })} disabled={readOnly} />
          </div>
        </div>
        <ConditionBuilder
          label="Run only when (optional CEL)"
          value={typeof draft.condition === 'string' ? (draft.condition as string) : ''}
          onCommit={(v) => onPatch({ condition: v || undefined })}
          objectName={conditionObject}
          disabled={readOnly}
        />
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
