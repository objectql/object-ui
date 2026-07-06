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
import { Zap } from 'lucide-react';
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
}: {
  draft: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  disabled?: boolean;
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

  return (
    <div className="flex min-h-0 flex-1 gap-4">
      {/* action list */}
      <div className="flex w-72 shrink-0 flex-col rounded-lg border">
        <header className="flex items-center gap-2 border-b px-3 py-2">
          <Zap className="h-3.5 w-3.5" />
          <span className="text-[13px] font-medium">{t('engine.studio.data.tab.actions', locale)}</span>
          <span className="text-[11px] text-muted-foreground">({actions.length})</span>
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
          <Inspector
            type="action"
            name={String(sel.name ?? '')}
            draft={sel as Record<string, unknown>}
            onPatch={patchSelected}
            readOnly={!!disabled}
            locale={locale}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-[12px] text-muted-foreground">
            {labelText(sel.label, String(sel.name ?? ''))}
          </div>
        )}
      </div>
    </div>
  );
}
