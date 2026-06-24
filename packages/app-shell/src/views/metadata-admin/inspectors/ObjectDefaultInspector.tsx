// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ObjectDefaultInspector — the "home" panel for the object designer,
 * shown when no field is selected.
 *
 * Without it, deselecting a field falls back to the generic whole-draft
 * SchemaForm, which (a) exposes a raw `fields` JSON editor the canvas
 * already owns, and (b) only renders whatever properties the server's
 * `/meta/types` schema happens to declare (often just `name`). This
 * curated panel instead edits the object-level basics directly, in the
 * active locale, in both create and edit.
 *
 * Create-mode niceties:
 *   • `name` is editable only while creating (it's the immutable PK once
 *     saved) and auto-derives a snake_case slug from the label until the
 *     author edits it directly — mirroring the protocol create form.
 *
 * All edits flow through `onPatch` as shallow draft patches.
 */

import * as React from 'react';
import type { MetadataDefaultInspectorProps } from '../default-inspector-registry';
import { InspectorShell, InspectorTextField } from './_shared';
import { Label } from '@object-ui/components';
import { toFieldNameLoose } from '../previews/object-fields-io';
import { slugify } from '../createDerive';
import { t } from '../i18n';

export function ObjectDefaultInspector({
  name,
  draft,
  onPatch,
  readOnly,
  locale,
}: MetadataDefaultInspectorProps) {
  const tr = React.useCallback((key: string) => t(key, locale), [locale]);
  // The host passes an empty `name` only while creating a new object.
  const createMode = !name;
  const str = (key: string) => (typeof draft[key] === 'string' ? (draft[key] as string) : '');

  // Auto-derive name from label until the user edits name directly.
  const nameTouched = React.useRef(false);

  const setLabel = (v: string) => {
    const patch: Record<string, unknown> = { label: v || undefined };
    if (createMode && !nameTouched.current) patch.name = slugify(v);
    onPatch(patch);
  };
  const setName = (v: string) => {
    nameTouched.current = true;
    onPatch({ name: toFieldNameLoose(v) });
  };

  const nameValue = createMode ? str('name') : name || str('name');
  const title = str('label') || name || tr('designer.object.kind');

  return (
    <InspectorShell
      kindLabel={tr('designer.object.kind')}
      title={title}
      onClose={() => {}}
      hideClose
    >
      <Section
        title={tr('designer.object.section.basic')}
        hint={tr('designer.object.section.basicHint')}
      >
        <Field hint={tr('designer.object.nameHint')}>
          <InspectorTextField
            label={tr('designer.object.name')}
            value={nameValue}
            onCommit={setName}
            disabled={readOnly || !createMode}
            mono
            testId="object-name-input"
            placeholder={tr('designer.object.namePlaceholder')}
          />
        </Field>
        <InspectorTextField
          label={tr('designer.object.label')}
          value={str('label')}
          onCommit={setLabel}
          disabled={readOnly}
          placeholder={tr('designer.object.labelPlaceholder')}
        />
        <InspectorTextField
          label={tr('designer.object.pluralLabel')}
          value={str('pluralLabel')}
          onCommit={(v) => onPatch({ pluralLabel: v || undefined })}
          disabled={readOnly}
          placeholder={tr('designer.object.pluralPlaceholder')}
        />
        <Field hint={tr('designer.object.iconHint')}>
          <InspectorTextField
            label={tr('designer.object.icon')}
            value={str('icon')}
            onCommit={(v) => onPatch({ icon: v || undefined })}
            disabled={readOnly}
            mono
            placeholder="building"
          />
        </Field>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{tr('designer.object.description')}</Label>
          <textarea
            value={str('description')}
            disabled={readOnly}
            rows={2}
            placeholder={tr('designer.object.descriptionPlaceholder')}
            onChange={(e) => onPatch({ description: e.target.value || undefined })}
            className="w-full text-sm rounded-md border bg-background px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </Section>
    </InspectorShell>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="border-b pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </div>
        {hint && <div className="text-[10px] normal-case text-muted-foreground/70 mt-0.5">{hint}</div>}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/** Wraps a field with a small help line below it. */
function Field({ hint, children }: { hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80 px-0.5 leading-snug">{hint}</p>}
    </div>
  );
}
