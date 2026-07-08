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
      <AccessSection draft={draft} onPatch={onPatch} readOnly={readOnly} tr={tr} />
    </InspectorShell>
  );
}

/* ─────────────── Access section (ADR-0066 D2/D3/④/⑤) ─────────────── */

const PER_OP_KEYS = ['read', 'create', 'update', 'delete'] as const;
type PerOpKey = (typeof PER_OP_KEYS)[number];

/** Comma/space-separated capability tags → clean string[]. */
function parseCaps(v: string): string[] {
  return v.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
}
function joinCaps(v: unknown): string {
  return Array.isArray(v) ? v.filter((s) => typeof s === 'string').join(', ') : '';
}

/**
 * Feature-detect whether the bundled `@objectstack/spec` supports the
 * per-operation `requiredPermissions` map (ADR-0066 ⑤ — spec ≥ 12.7 exports
 * `ObjectRequiredPermissionsSchema`). Older specs only accept `string[]`;
 * offering the map form there would author a draft the client-side Zod
 * validation rejects. Progressive enhancement: the toggle appears once the
 * dependency is bumped, with no further code change.
 */
function usePerOpSupport(): boolean {
  const [supported, setSupported] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    import('@objectstack/spec/data')
      .then((m: any) => {
        if (!cancelled) setSupported(typeof m?.ObjectRequiredPermissionsSchema !== 'undefined');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return supported;
}

/**
 * Object-level access controls:
 *  - `access.default` posture (ADR-0066 D2/④): `private` opts the object out
 *    of the `'*'` wildcard grant — access then needs an explicit per-object
 *    grant (or the View/Modify-All superuser bypass).
 *  - `requiredPermissions` capability AND-gate (D3/⑤): `string[]` gates every
 *    operation; the per-operation map gates read/create/update/delete
 *    independently (read-open / write-gated).
 */
function AccessSection({
  draft,
  onPatch,
  readOnly,
  tr,
}: {
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  tr: (key: string) => string;
}) {
  const perOpSupported = usePerOpSupport();

  const posture = ((draft.access as { default?: string } | undefined)?.default === 'private')
    ? 'private' : 'public';
  const rp = draft.requiredPermissions;
  const isPerOp = !!rp && typeof rp === 'object' && !Array.isArray(rp);
  const mode: 'all' | 'perOp' = isPerOp ? 'perOp' : 'all';

  const setPosture = (v: string) => {
    // `public` is the spec default — clear the key instead of writing it out.
    onPatch({ access: v === 'private' ? { default: 'private' } : undefined });
  };

  const setAllCaps = (v: string) => {
    const caps = parseCaps(v);
    onPatch({ requiredPermissions: caps.length > 0 ? caps : undefined });
  };

  const setPerOpCaps = (op: PerOpKey, v: string) => {
    const current = isPerOp ? { ...(rp as Record<string, unknown>) } : {};
    const caps = parseCaps(v);
    if (caps.length > 0) current[op] = caps; else delete current[op];
    onPatch({ requiredPermissions: Object.keys(current).length > 0 ? current : undefined });
  };

  const setMode = (m: 'all' | 'perOp') => {
    if (m === mode) return;
    if (m === 'perOp') {
      // Carry the flat list into every operation so nothing silently loosens.
      const caps = Array.isArray(rp) ? (rp as string[]) : [];
      onPatch({
        requiredPermissions: caps.length > 0
          ? { read: caps, create: caps, update: caps, delete: caps }
          : {},
      });
    } else {
      // Union the per-op caps back into one flat list (tightest lossless fold).
      const map = isPerOp ? (rp as Record<string, unknown>) : {};
      const union = [...new Set(PER_OP_KEYS.flatMap((k) => (Array.isArray(map[k]) ? (map[k] as string[]) : [])))];
      onPatch({ requiredPermissions: union.length > 0 ? union : undefined });
    }
  };

  return (
    <Section
      title={tr('designer.object.section.access')}
      hint={tr('designer.object.section.accessHint')}
    >
      <Field hint={posture === 'private' ? tr('designer.object.posture.privateHint') : tr('designer.object.posture.publicHint')}>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{tr('designer.object.posture')}</Label>
          <select
            value={posture}
            disabled={readOnly}
            onChange={(e) => setPosture(e.target.value)}
            data-testid="object-access-posture"
            className="w-full rounded border bg-background px-2 py-1 text-[12px]"
          >
            <option value="public">{tr('designer.object.posture.public')}</option>
            <option value="private">{tr('designer.object.posture.private')}</option>
          </select>
        </div>
      </Field>

      <Field hint={tr('designer.object.reqPerms.hint')}>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{tr('designer.object.reqPerms')}</Label>
            {perOpSupported && (
              <div className="inline-flex rounded border text-[11px]" role="group">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setMode('all')}
                  className={`px-1.5 py-0.5 rounded-l ${mode === 'all' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                >
                  {tr('designer.object.reqPerms.mode.all')}
                </button>
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setMode('perOp')}
                  data-testid="object-reqperms-perop"
                  className={`px-1.5 py-0.5 rounded-r border-l ${mode === 'perOp' ? 'bg-primary/10 text-primary' : 'text-muted-foreground'}`}
                >
                  {tr('designer.object.reqPerms.mode.perOp')}
                </button>
              </div>
            )}
          </div>
          {mode === 'all' ? (
            <InspectorTextField
              label=""
              value={joinCaps(rp)}
              onCommit={setAllCaps}
              disabled={readOnly}
              mono
              testId="object-reqperms-all"
              placeholder={tr('designer.object.reqPerms.placeholder')}
            />
          ) : (
            <div className="space-y-1.5">
              {PER_OP_KEYS.map((op) => (
                <div key={op} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[11px] text-muted-foreground capitalize">
                    {tr(`designer.object.reqPerms.op.${op}`)}
                  </span>
                  <div className="flex-1">
                    <InspectorTextField
                      label=""
                      value={joinCaps((rp as Record<string, unknown>)?.[op])}
                      onCommit={(v) => setPerOpCaps(op, v)}
                      disabled={readOnly}
                      mono
                      testId={`object-reqperms-${op}`}
                      placeholder={tr('designer.object.reqPerms.placeholder')}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Field>
    </Section>
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
