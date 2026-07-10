/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — object Settings view (builder-ui Phase B).
 *
 * Two stacked cards:
 *  1. Basics — hosts the SAME default inspector metadata-admin uses
 *     (`getMetadataDefaultInspector('object')` → ObjectDefaultInspector):
 *     label / pluralLabel / icon / description, one implementation for both
 *     surfaces.
 *  2. Record sharing (ADR-0056) — the object-level Org-Wide Default (OWD)
 *     `sharingModel` (private | public_read | public_read_write |
 *     controlled_by_parent). This is the baseline record-level visibility the
 *     runtime applies BEFORE positions and sharing rules. Since ADR-0090 D1
 *     an unset value defaults to `private` (secure default) — the old
 *     fully-public cliff is gone, so leaving it unset is safe.
 *  3. Semantic roles (ADR-0085) — the cross-surface presentation roles:
 *     `nameField`, `stageField` (string | false | unset), `highlightFields`.
 *     These are the ONLY presentation knobs the protocol carries, so the
 *     builder must make them directly editable — otherwise designers fall
 *     back to guessing which heuristic picked their title/stepper/columns.
 */

import React from 'react';
import { Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { getMetadataDefaultInspector } from '../metadata-admin/default-inspector-registry';
import { readFields } from '../metadata-admin/previews/object-fields-io';
import { t, tFormat, type SupportedLocale } from '../metadata-admin/i18n';

export function ObjectSettingsPanel({
  name,
  draft,
  onPatch,
  disabled,
  locale,
}: {
  name: string;
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
  locale: SupportedLocale;
}) {
  const DefaultInspector = getMetadataDefaultInspector('object');

  const fields = React.useMemo(() => readFields(draft.fields).entries, [draft.fields]);
  const selectFields = fields.filter((e) => (e.def.type ?? 'text') === 'select');

  const nameField = typeof draft.nameField === 'string' ? draft.nameField : '';
  const stageField = draft.stageField as string | false | undefined;
  const highlightFields = Array.isArray(draft.highlightFields)
    ? (draft.highlightFields as unknown[]).filter((f): f is string => typeof f === 'string')
    : [];

  const highlightCandidates = fields.filter(
    (e) => e.def.hidden !== true && !highlightFields.includes(e.name),
  );

  // Record sharing (OWD). Canonical values only — spec 13 (ADR-0090 D4)
  // rejects the legacy `read`/`read_write`/`full` aliases at authoring time,
  // and an unset value defaults to `private` (ADR-0090 D1).
  const sharingModel = typeof draft.sharingModel === 'string' ? draft.sharingModel : '';
  const sharingDescKey =
    sharingModel === 'private'
      ? 'engine.studio.settings.sharingDescPrivate'
      : sharingModel === 'public_read'
        ? 'engine.studio.settings.sharingDescPublicRead'
        : sharingModel === 'public_read_write'
          ? 'engine.studio.settings.sharingDescPublicReadWrite'
          : sharingModel === 'controlled_by_parent'
            ? 'engine.studio.settings.sharingDescControlledByParent'
            : 'engine.studio.settings.sharingDescUnset';

  // External OWD dial (ADR-0090 D11): baseline for portal/partner principals.
  // Defaults to private when unset; must never be WIDER than the internal
  // model (ordering: private < public_read < public_read_write — the D7
  // security-posture linter rejects the wider shape at publish).
  const externalSharingModel =
    typeof draft.externalSharingModel === 'string' ? draft.externalSharingModel : '';
  const OWD_WIDTH: Record<string, number> = { private: 0, public_read: 1, public_read_write: 2 };
  const externalWider =
    externalSharingModel in OWD_WIDTH &&
    sharingModel in OWD_WIDTH &&
    OWD_WIDTH[externalSharingModel] > OWD_WIDTH[sharingModel];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <section className="rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Settings2 className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.settings.basics', locale)}</span>
        </header>
        <div className="max-w-xl p-3">
          {DefaultInspector ? (
            <DefaultInspector
              type="object"
              name={name}
              draft={draft}
              onPatch={onPatch}
              readOnly={!!disabled}
              locale={locale}
            />
          ) : (
            <p className="text-[12px] text-muted-foreground">{t('engine.studio.settings.noInspector', locale)}</p>
          )}
        </div>
      </section>

      <section className="rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.settings.sharing', locale)}</span>
          <span className="text-[11px] text-muted-foreground">
            {t('engine.studio.settings.sharingHint', locale)}
          </span>
        </header>
        <div className="grid max-w-xl gap-2 p-3">
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              {t('engine.studio.settings.sharingModel', locale)}
            </span>
            <select
              value={sharingModel}
              disabled={disabled}
              data-testid="owd-internal-select"
              onChange={(e) =>
                onPatch(e.target.value ? { sharingModel: e.target.value } : { sharingModel: undefined })
              }
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">{t('engine.studio.settings.sharingUnset', locale)}</option>
              <option value="private">{t('engine.studio.settings.sharingPrivate', locale)}</option>
              <option value="public_read">{t('engine.studio.settings.sharingPublicRead', locale)}</option>
              <option value="public_read_write">{t('engine.studio.settings.sharingPublicReadWrite', locale)}</option>
              <option value="controlled_by_parent">
                {t('engine.studio.settings.sharingControlledByParent', locale)}
              </option>
            </select>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {t(sharingDescKey, locale)}
          </p>
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              {t('engine.studio.settings.sharingExternal', locale)}
            </span>
            <select
              value={externalSharingModel}
              disabled={disabled}
              data-testid="owd-external-select"
              onChange={(e) =>
                onPatch(
                  e.target.value
                    ? { externalSharingModel: e.target.value }
                    : { externalSharingModel: undefined },
                )
              }
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">{t('engine.studio.settings.sharingExternalUnset', locale)}</option>
              <option value="private">{t('engine.studio.settings.sharingPrivate', locale)}</option>
              <option value="public_read">{t('engine.studio.settings.sharingPublicRead', locale)}</option>
              <option value="public_read_write">{t('engine.studio.settings.sharingPublicReadWrite', locale)}</option>
              <option value="controlled_by_parent">
                {t('engine.studio.settings.sharingControlledByParent', locale)}
              </option>
            </select>
          </label>
          <p
            data-testid="owd-external-desc"
            className={
              externalWider
                ? 'text-[11px] text-amber-600 dark:text-amber-500'
                : 'text-[11px] text-muted-foreground'
            }
          >
            {t(
              externalWider
                ? 'engine.studio.settings.sharingExternalWider'
                : 'engine.studio.settings.sharingExternalDesc',
              locale,
            )}
          </p>
        </div>
      </section>

      <section className="rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.settings.semanticRoles', locale)}</span>
          <span className="text-[11px] text-muted-foreground">
            {t('engine.studio.settings.semanticHint', locale)}
          </span>
        </header>
        <div className="grid max-w-xl gap-4 p-3">
          {/* nameField */}
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              {t('engine.studio.settings.nameField', locale)}
            </span>
            <select
              value={nameField}
              disabled={disabled}
              onChange={(e) => onPatch(e.target.value ? { nameField: e.target.value } : { nameField: undefined })}
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">{t('engine.studio.settings.autoDerive', locale)}</option>
              {fields.map((e) => (
                <option key={e.name} value={e.name}>
                  {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                </option>
              ))}
            </select>
          </label>

          {/* stageField */}
          <label className="block">
            <span className="mb-1 block text-[11px] text-muted-foreground">
              {t('engine.studio.settings.stageField', locale)}
            </span>
            <select
              value={stageField === false ? '__none__' : (stageField ?? '')}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                onPatch({ stageField: v === '__none__' ? false : v === '' ? undefined : v });
              }}
              className="w-full rounded border bg-background px-2 py-1 text-[12px]"
            >
              <option value="">{t('engine.studio.settings.autoDetect', locale)}</option>
              <option value="__none__">{t('engine.studio.settings.stageNone', locale)}</option>
              {selectFields.map((e) => (
                <option key={e.name} value={e.name}>
                  {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                </option>
              ))}
            </select>
          </label>

          {/* highlightFields */}
          <div>
            <span className="mb-1 block text-[11px] text-muted-foreground">
              {t('engine.studio.settings.highlightFields', locale)}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {highlightFields.map((f) => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                >
                  {f}
                  {!disabled && (
                    <button
                      type="button"
                      aria-label={tFormat('engine.studio.settings.removeField', locale, { field: f })}
                      onClick={() => onPatch({ highlightFields: highlightFields.filter((x) => x !== f) })}
                      className="rounded-full hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {!disabled && highlightCandidates.length > 0 && (
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    onPatch({ highlightFields: [...highlightFields, e.target.value] });
                  }}
                  className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
                >
                  <option value="">{t('engine.studio.settings.addFieldOption', locale)}</option>
                  {highlightCandidates.map((e) => (
                    <option key={e.name} value={e.name}>
                      {typeof e.def.label === 'string' ? `${e.def.label} (${e.name})` : e.name}
                    </option>
                  ))}
                </select>
              )}
              {highlightFields.length === 0 && (
                <span className="text-[11px] text-muted-foreground">{t('engine.studio.settings.undeclared', locale)}</span>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
