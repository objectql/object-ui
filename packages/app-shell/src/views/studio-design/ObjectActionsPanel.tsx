/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — Actions view.
 *
 * Actions carry an `objectName` and defineStack() folds them into the object's
 * inline `actions[]` array — so, like validations, they live ON the object
 * draft and are edited via `onPatch({ actions })` + the object's Save draft.
 * This is the object-scoped slice of Salesforce's "Buttons, Links & Actions".
 *
 * Master-detail: a left list of the object's actions, and on the right the
 * REAL `action` metadata form — the registered type-aware ActionDefaultInspector
 * (getMetadataDefaultInspector('action')), the same editor the metadata admin
 * uses — rather than a hand-rolled panel. Selecting an action feeds that one
 * array element to the inspector; its onPatch writes the element back into the
 * array. Global actions (no objectName) are not object-scoped and live elsewhere.
 */

import React from 'react';
import { Zap, Plus, Trash2 } from 'lucide-react';
import { getIcon } from '../../utils/getIcon';
import { getMetadataDefaultInspector } from '../metadata-admin/default-inspector-registry';
import { t, useMetadataLocale } from '../metadata-admin/i18n';

interface ActionItem {
  name?: string;
  label?: unknown;
  icon?: unknown;
  type?: unknown;
  [key: string]: unknown;
}

function readActions(input: unknown): ActionItem[] {
  if (!Array.isArray(input)) return [];
  return input.filter((a): a is ActionItem => !!a && typeof a === 'object');
}

/** A fresh, unique, snake_case action name scoped to the object. */
function nextActionName(objectName: string, existing: string[]): string {
  const base = (objectName || 'action').replace(/[^a-z0-9_]/gi, '_').toLowerCase();
  const taken = new Set(existing);
  let i = existing.length + 1;
  let name = `${base}_action_${i}`;
  while (taken.has(name)) name = `${base}_action_${++i}`;
  return name;
}

/** An I18nLabel may be a string OR a localized object — never render it raw. */
function labelText(label: unknown, fallback: string): string {
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object') {
    const o = label as Record<string, unknown>;
    for (const k of ['default', 'en-US', 'en', 'zh-CN']) {
      if (typeof o[k] === 'string') return o[k] as string;
    }
    const first = Object.values(o).find((v) => typeof v === 'string');
    if (typeof first === 'string') return first;
  }
  return fallback;
}

export function ObjectActionsPanel({
  draft,
  onPatch,
  disabled,
  actionSchema,
}: {
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
  /**
   * The live server JSONSchema for the `action` type (`/meta/types`). Handed to
   * ActionDefaultInspector as `serverSchema` so its "More fields" section can
   * edit any spec property not curated above — keeping this a faithful,
   * forward-compatible config panel for the action metadata.
   */
  actionSchema?: Record<string, unknown>;
}) {
  const locale = useMetadataLocale();
  const actions = React.useMemo(() => readActions(draft.actions), [draft.actions]);
  const [selected, setSelected] = React.useState<string | null>(null);
  // Default-select the first action so the detail pane isn't a dead end when
  // actions exist; fall back when the selection no longer matches.
  const effectiveSelected = actions.some((a) => a.name === selected) ? selected : (actions[0]?.name ?? null);
  const sel = actions.find((a) => a.name === effectiveSelected) ?? null;

  const Inspector = getMetadataDefaultInspector('action');

  // Apply a shallow patch to the SELECTED action within the object's inline
  // actions array, then hand the whole array back up so the object draft (and
  // its Save draft) owns persistence — exactly like ObjectValidationsPanel.
  const patchSelected = React.useCallback(
    (patch: Record<string, unknown>) => {
      if (!sel) return;
      const next = actions.map((a) => (a.name === sel.name ? { ...a, ...patch } : a));
      onPatch({ actions: next });
      if (typeof patch.name === 'string' && patch.name !== sel.name) setSelected(patch.name);
    },
    [actions, sel, onPatch],
  );

  const objectName = typeof draft.name === 'string' ? draft.name : '';

  const addAction = React.useCallback(() => {
    const name = nextActionName(objectName, actions.map((a) => String(a.name ?? '')));
    // Minimal *valid* skeleton: a script action bound to this object, seeded
    // with a runnable body. The body's `language` discriminator is required —
    // an unseeded `type:'script'` action 422s the whole draft save the moment
    // the user types into the body (same dead-end class as a fresh validation
    // rule needing a placeholder condition). The user configures the rest
    // (behavior/placement/…) in the form on the right.
    const fresh: ActionItem = {
      name,
      label: t('engine.studio.actions.newLabel', locale),
      type: 'script',
      objectName,
      body: { language: 'js', source: 'return { ok: true };' },
    };
    onPatch({ actions: [...actions, fresh] });
    setSelected(name);
  }, [actions, objectName, onPatch, locale]);

  const removeAction = React.useCallback(
    (name: string) => {
      onPatch({ actions: actions.filter((a) => a.name !== name) });
      setSelected(null);
    },
    [actions, onPatch],
  );

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* action list */}
      <div className="flex w-72 shrink-0 flex-col rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Zap className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.data.tab.actions', locale)}</span>
          <span className="text-[11px] text-muted-foreground">({actions.length})</span>
          {!disabled && (
            <button
              type="button"
              onClick={addAction}
              className="ml-auto inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
            >
              <Plus className="h-3 w-3" /> {t('engine.studio.new', locale)}
            </button>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-auto">
          {actions.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] leading-5 text-muted-foreground">
              {t('engine.studio.actions.none', locale)}
            </p>
          ) : (
            actions.map((a) => {
              const Icon = getIcon(typeof a.icon === 'string' ? a.icon : undefined);
              const type = typeof a.type === 'string' ? a.type : '';
              return (
                <button
                  key={String(a.name)}
                  type="button"
                  onClick={() => setSelected(a.name ?? null)}
                  className={
                    'flex w-full items-center gap-2 border-b px-3 py-2 text-left text-[12px] ' +
                    (effectiveSelected === a.name ? 'bg-muted' : 'hover:bg-muted/50')
                  }
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate font-medium">{labelText(a.label, String(a.name ?? ''))}</span>
                  {type && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {type}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* properties — the real Action metadata form */}
      <div className="flex min-w-0 flex-1 flex-col overflow-auto rounded-lg border">
        {!sel ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            {t('engine.studio.actions.pick', locale)}
          </div>
        ) : Inspector ? (
          <>
            {!disabled && (
              <div className="flex shrink-0 items-center justify-end border-b px-2 py-1">
                <button
                  type="button"
                  onClick={() => removeAction(sel.name!)}
                  className="inline-flex items-center gap-1 rounded border border-destructive/40 px-2 py-0.5 text-[11px] text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3 w-3" /> {t('engine.studio.actions.delete', locale)}
                </button>
              </div>
            )}
            {/* eslint-disable-next-line react-hooks/static-components -- getMetadataDefaultInspector returns a registered component (stable), not one created during render */}
            <Inspector
              type="action"
              name={String(sel.name ?? '')}
              draft={sel as Record<string, unknown>}
              onPatch={patchSelected}
              readOnly={!!disabled}
              locale={locale}
              serverSchema={actionSchema}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            {labelText(sel.label, String(sel.name ?? ''))}
          </div>
        )}
      </div>
    </div>
  );
}
