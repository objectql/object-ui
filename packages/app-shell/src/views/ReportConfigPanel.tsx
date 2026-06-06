// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * ReportConfigPanel — the runtime ReportView's right-rail "report editor".
 *
 * MIGRATED: this panel hosts the studio's spec-driven
 * {@link ReportDefaultInspector} instead of the legacy
 * `buildReportSchema` / `ConfigPanelRenderer` engine in `plugin-report`, so the
 * runtime and the metadata studio share ONE report-editing surface. The
 * inspector renders the report config fields straight from `@objectstack/spec`
 * (`reportForm` / `ReportSchema`) plus a curated object / type / columns layer.
 *
 * It lives in `app-shell` (next to the studio inspector) rather than in
 * `plugin-report`: `app-shell` depends on `plugin-report`, so hosting the
 * inspector here avoids the circular import a plugin-side panel would need.
 *
 * The Report document is FLAT (label / objectName / type / columns / … at the
 * top level), so — unlike the View migration — no shape adapter is required:
 * the report config IS the inspector draft. Field loading is network-free:
 * the host's `availableFields` are mapped into `objectFieldsOverride` so the
 * inspector issues no `client.get('object', …)` request.
 *
 * Props mirror the legacy `plugin-report` panel so it is a drop-in replacement
 * for ReportView.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@object-ui/components';
import { useObjectTranslation } from '@object-ui/i18n';
import { X } from 'lucide-react';
import { ReportDefaultInspector } from './metadata-admin/inspectors/ReportDefaultInspector';
import { RuntimeDraftBar } from './RuntimeDraftBar';
import { detectLocale } from './metadata-admin/i18n';
import type { ObjectFieldInfo } from './metadata-admin/previews/useObjectFields';

/** Field option shape the host (ReportView) already computes. */
interface AvailableField {
  value: string;
  label?: string;
  type?: string;
}

export interface ReportConfigPanelProps {
  /** Whether the panel is open. */
  open: boolean;
  /** Close callback. */
  onClose: () => void;
  /** The current report definition (flat spec Report document). */
  config: Record<string, any> | null;
  /** Persist all draft changes. */
  onSave: (config: Record<string, any>) => void;
  /** Called on every field change so the host can drive a live preview. */
  onFieldChange?: (key: string, value: any, draft?: Record<string, any>) => void;
  /** Field catalog for the bound object — mapped to a network-free override. */
  availableFields?: AvailableField[];
  /** Reserved for parity with the legacy panel; unused by the inspector. */
  getFieldsForObject?: (objectName: string | undefined) => AvailableField[] | undefined;
  /** Report artifact name — the `:name` for the ADR-0034 draft/publish chrome. */
  name?: string;
  /**
   * Studio metadata client — drives the draft/publish chrome
   * ({@link RuntimeDraftBar}).
   */
  metadataClient?: any;
}

/** Map the host's `{ value, label, type }` fields into the inspector's catalog. */
function toObjectFields(fields: AvailableField[] | undefined): ObjectFieldInfo[] {
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => ({
    name: f.value,
    label: f.label || f.value,
    type: f.type || 'text',
    hidden: false,
  }));
}

export function ReportConfigPanel({
  open,
  onClose,
  config,
  onSave,
  onFieldChange,
  availableFields,
  name,
  metadataClient,
}: ReportConfigPanelProps) {
  const { t } = useObjectTranslation();
  const locale = useMemo(() => detectLocale(), []);
  const objectFields = useMemo(() => toObjectFields(availableFields), [availableFields]);
  // Unsaved-edits flag — gates Publish (mirrors studio's "save first").
  const [dirty, setDirty] = useState(false);

  // Draft state seeded from `config`. Rebuilt only when the source identity
  // changes (the host stabilizes `config` and bumps it on open / save) — never
  // on every live field change — so in-flight edits are not clobbered.
  const initialDraft = useMemo<Record<string, any>>(() => ({ ...(config ?? {}) }), [config]);
  const [draft, setDraft] = useState<Record<string, any>>(initialDraft);
  const draftRef = useRef(draft);
  const lastSourceRef = useRef(initialDraft);
  if (lastSourceRef.current !== initialDraft) {
    lastSourceRef.current = initialDraft;
    draftRef.current = initialDraft;
    setDraft(initialDraft);
    setDirty(false);
  }

  // Shallow-merge an inspector patch into the draft, then mirror each changed
  // field back to the host so the live preview reflects the edit.
  const handlePatch = useCallback((patch: Record<string, unknown>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    setDirty(true);
    if (onFieldChange) {
      for (const [key, value] of Object.entries(patch)) {
        onFieldChange(key, value, next);
      }
    }
  }, [onFieldChange]);

  const handleSave = useCallback(() => {
    onSave(draftRef.current);
    setDirty(false);
    onClose();
  }, [onSave, onClose]);

  // ADR-0034 (#1515): resume a pending draft into the inspector on open
  // (flag-ON only). The report document IS the inspector draft, so seed it
  // directly.
  const handleResumeDraft = useCallback((body: Record<string, unknown>) => {
    const next = { ...body };
    draftRef.current = next;
    setDraft(next);
    setDirty(false);
  }, []);

  const handleDiscard = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <aside
      className="hidden sm:flex w-[440px] shrink-0 flex-col border-l bg-background h-full"
      data-testid="report-config-panel"
      role="complementary"
      aria-label={t('report.editor.title', { defaultValue: 'Edit report' })}
    >
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 shrink-0">
        <div className="text-sm font-medium truncate">
          {t('report.editor.title', { defaultValue: 'Edit report' })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0"
          aria-label={t('common.close', { defaultValue: 'Close' })}
          data-testid="report-config-close"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <ReportDefaultInspector
          type="report"
          name={typeof draft.name === 'string' ? draft.name : ''}
          draft={draft}
          readOnly={false}
          locale={locale}
          objectFieldsOverride={objectFields}
          onPatch={handlePatch}
        />
      </div>

      <div
        data-testid="report-config-footer"
        className="flex items-center justify-end gap-2 border-t px-4 py-2.5 shrink-0"
      >
        <RuntimeDraftBar
          type="report"
          name={name}
          metadataClient={metadataClient}
          dirty={dirty}
          onResume={handleResumeDraft}
        />
        <Button variant="ghost" size="sm" onClick={handleDiscard} data-testid="report-config-discard">
          {t('common.cancel', { defaultValue: 'Cancel' })}
        </Button>
        <Button size="sm" onClick={handleSave} data-testid="report-config-save">
          {t('common.save', { defaultValue: 'Save' })}
        </Button>
      </div>
    </aside>
  );
}
