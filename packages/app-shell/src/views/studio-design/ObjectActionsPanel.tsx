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
 * Actions carry an `objectName` and are folded into the object's inline
 * `actions[]` array by defineStack() — so, like validations, they live ON the
 * object draft and need no separate fetch. This is the object-scoped slice of
 * Salesforce's "Buttons, Links & Actions": the user-invokable operations that
 * surface as buttons on this object's records and lists.
 *
 * Read-only inventory (first cut): an action's behaviour is a script / flow /
 * URL / API target authored elsewhere, so a row editor can't faithfully edit
 * it — same stance as the Hooks tab. We surface each action's icon, label,
 * type and the locations it shows in, so nothing invokable on the object is
 * invisible. Declarative fields (label / icon / locations) can grow into an
 * editor later. Global actions (no objectName, e.g. command-palette items)
 * are NOT object-scoped and live elsewhere.
 */

import React from 'react';
import { getIcon } from '../../utils/getIcon';
import { t, useMetadataLocale } from '../metadata-admin/i18n';

interface ActionItem {
  name?: string;
  label?: unknown;
  icon?: unknown;
  type?: unknown;
  locations?: unknown;
  description?: unknown;
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

function readLocations(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((l): l is string => typeof l === 'string');
}

export function ObjectActionsPanel({ draft }: { draft: Record<string, unknown> }) {
  const locale = useMetadataLocale();
  const actions = React.useMemo(() => readActions(draft.actions), [draft.actions]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <p className="text-[11px] leading-5 text-muted-foreground">{t('engine.studio.actions.explain', locale)}</p>

      {actions.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] leading-5 text-muted-foreground">{t('engine.studio.actions.none', locale)}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {actions.map((a) => {
            const Icon = getIcon(typeof a.icon === 'string' ? a.icon : undefined);
            const type = typeof a.type === 'string' ? a.type : '';
            const locations = readLocations(a.locations);
            const description = typeof a.description === 'string' ? a.description : '';
            return (
              <div key={String(a.name)} className="rounded-lg border px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {labelText(a.label, String(a.name ?? ''))}
                  </span>
                  {type && (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      {type}
                    </span>
                  )}
                </div>

                {description && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{description}</p>}

                {locations.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-muted-foreground/70">{t('engine.studio.actions.shownIn', locale)}</span>
                    {locations.map((loc) => (
                      <span key={loc} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {loc}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
