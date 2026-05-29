// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectPreview — split-mode preview for an Object metadata draft.
 *
 *   • Data mode (default) — runs the production `<ObjectGrid>` against
 *     the draft's columns. Shows EXACTLY what users see in the deployed
 *     app (no parallel renderer, no synthetic placeholders).
 *
 *   • Designer mode — mounts `<FieldDesigner>` from
 *     `@object-ui/plugin-designer` so the operator can add / rename /
 *     reorder fields visually without leaving the preview pane. Edits
 *     flow back through the host's `onPatch` callback. Field types the
 *     designer can't represent (master_detail, tree, multiselect, …)
 *     are preserved verbatim via `object-fields-bridge` so the round-
 *     trip is non-destructive.
 *
 * Schema editing of the rich per-field properties (validation rules,
 * formula expressions, RLS, …) is still owned by the Form panel —
 * the designer covers the high-volume operations (drag-add a field,
 * rename, retype, drop) and defers the long tail to the form.
 */

import * as React from 'react';
import { ObjectGrid } from '@object-ui/plugin-grid';
import { FieldDesigner } from '@object-ui/plugin-designer';
import type {
  ObjectGridSchema,
  ListColumn,
  DesignerFieldDefinition,
} from '@object-ui/types';
import type { MetadataPreviewProps } from '../preview-registry';
import { PreviewShell, PreviewMessage, PreviewErrorBoundary } from './PreviewShell';
import { Button, Badge } from '@object-ui/components';
import { Database, Pencil } from 'lucide-react';
import { bridgeFromDraft, commitToDraft } from './object-fields-bridge';

interface FieldDef {
  name?: string;
  label?: string;
  type?: string;
  [k: string]: unknown;
}

/** Derive grid columns from the draft's `fields` record/array. */
function deriveColumns(fieldsInput: unknown): ListColumn[] {
  if (!fieldsInput) return [];
  const entries: Array<{ name: string; def: FieldDef }> = Array.isArray(fieldsInput)
    ? (fieldsInput as FieldDef[])
        .map((def, i) => ({
          name: String(def?.name ?? `field_${i + 1}`),
          def,
        }))
        .filter((x) => !!x.name)
    : Object.entries(fieldsInput as Record<string, FieldDef>).map(([name, def]) => ({
        name,
        def,
      }));

  return entries.map(({ name, def }) => ({
    field: name,
    label: String(def?.label ?? name),
    type: def?.type as ListColumn['type'],
  }));
}

type Mode = 'data' | 'designer';

export function ObjectPreview({
  name,
  draft,
  onPatch,
}: MetadataPreviewProps) {
  const objectName = String((draft as any).name ?? name ?? '');
  const columns = React.useMemo(() => deriveColumns((draft as any).fields), [draft]);
  const label = String((draft as any).label ?? objectName);
  const pluralLabel = String((draft as any).pluralLabel ?? `${label}s`);

  // Default to Designer: even in read-only tiers, browsing the field
  // definitions is more useful than an empty Data grid. FieldDesigner
  // gracefully degrades via its `readOnly` prop when onPatch is absent.
  const [mode, setMode] = React.useState<Mode>('designer');

  if (!objectName) {
    return (
      <PreviewShell hint="object">
        <PreviewMessage>
          Give the object a name in the Form tab to enable the preview.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  const modeSwitcher = (
    <div
      role="tablist"
      aria-label="Preview mode"
      className="inline-flex items-center rounded-md border bg-background p-0.5"
    >
      <ModeButton
        active={mode === 'designer'}
        onClick={() => setMode('designer')}
        icon={<Pencil className="h-3 w-3" />}
        label="Designer"
      />
      <ModeButton
        active={mode === 'data'}
        onClick={() => setMode('data')}
        icon={<Database className="h-3 w-3" />}
        label="Data"
      />
    </div>
  );

  if (mode === 'designer') {
    return (
      <PreviewShell hint={`object · designer`} toolbar={modeSwitcher}>
        <PreviewErrorBoundary fallbackHint="The field designer couldn't be rendered. Switch to Data mode or check the Form tab.">
          <DesignerMode
            objectName={objectName}
            draft={draft}
            onPatch={onPatch}
          />
        </PreviewErrorBoundary>
      </PreviewShell>
    );
  }

  if (columns.length === 0) {
    return (
      <PreviewShell hint="object · 0 fields" toolbar={modeSwitcher}>
        <PreviewMessage>
          Add at least one field in the Form tab to enable the preview.
        </PreviewMessage>
      </PreviewShell>
    );
  }

  // Build a minimal ObjectGridSchema. When `data` is omitted ObjectGrid
  // defaults to `{ provider: 'object', object: objectName }` and fetches
  // real rows from the REST API — exactly what production does.
  const schema: ObjectGridSchema = {
    type: 'object-grid',
    objectName,
    label: pluralLabel,
    columns,
  };

  return (
    <PreviewShell
      hint={`object · ${columns.length} field${columns.length === 1 ? '' : 's'}`}
      toolbar={modeSwitcher}
    >
      <PreviewErrorBoundary fallbackHint="The object metadata couldn't be rendered. Save the draft and reload to retry.">
        <div className="h-full overflow-auto">
          <ObjectGrid schema={schema} />
        </div>
      </PreviewErrorBoundary>
    </PreviewShell>
  );
}

function ModeButton({
  active,
  onClick,
  disabled,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-sm transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground',
        disabled ? 'opacity-50 cursor-not-allowed' : '',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * DesignerMode — encapsulates the bridge so the parent doesn't re-run
 * `bridgeFromDraft` on every render. We re-derive only when the draft
 * `fields` reference actually changes (e.g. after a Save reload or a
 * Form-tab edit).
 */
function DesignerMode({
  objectName,
  draft,
  onPatch,
}: {
  objectName: string;
  draft: Record<string, unknown>;
  onPatch?: (patch: Record<string, unknown>) => void;
}) {
  const fieldsInput = (draft as any).fields;
  const bridge = React.useMemo(() => bridgeFromDraft(fieldsInput), [fieldsInput]);
  const preservedCount = bridge.preserved.size;

  const handleFieldsChange = React.useCallback(
    (next: DesignerFieldDefinition[]) => {
      if (!onPatch) return;
      const merged = commitToDraft(next, bridge);
      onPatch({ fields: merged });
    },
    [onPatch, bridge],
  );

  return (
    <div className="h-full flex flex-col">
      {preservedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] border-b bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200">
          <Badge variant="outline" className="text-[10px] border-amber-400/60">
            {preservedCount}
          </Badge>
          <span>
            field{preservedCount === 1 ? '' : 's'} use type
            {preservedCount === 1 ? '' : 's'} the designer can't edit (e.g.
            <code className="mx-1">master_detail</code>,
            <code className="mx-1">tree</code>,
            <code className="mx-1">multiselect</code>). Edit them in the
            Form tab — they're preserved here.
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        <FieldDesigner
          objectName={objectName}
          fields={bridge.designerFields}
          onFieldsChange={handleFieldsChange}
          readOnly={!onPatch}
        />
      </div>
    </div>
  );
}
