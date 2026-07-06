/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — Hooks view.
 *
 * Unlike Validations (which are an inline `ObjectSchema.validations` array),
 * hooks are a SEPARATE `hook` metadata type whose `object` field targets one
 * object, a list of objects, or `*` (all). This panel lists the hooks that
 * fire on the selected object — the honest inventory of lifecycle logic that
 * runs on its reads/writes.
 *
 * Read-only by design: a hook's actual behaviour lives in its `body`/`handler`
 * (an expression or sandboxed JS authored in code), which a row editor can't
 * faithfully edit — same philosophy as the non-`script` validation rules,
 * which are surfaced but not edited. We show name, subscribed events, the
 * optional CEL `condition` gate, priority and async flag so nothing that runs
 * on save is invisible.
 */

import React from 'react';
import { Webhook } from 'lucide-react';
import { useMetadataClient } from '../metadata-admin/useMetadata';
import { t, tFormat, useMetadataLocale } from '../metadata-admin/i18n';
import { formatMetadataError } from './metadataError';

interface HookItem {
  name?: string;
  label?: string;
  object?: string | string[];
  events?: string[];
  // `ExpressionInputSchema` — a bare CEL string OR an object `{ dialect, source }`
  // (a CEL tagged template serialises to the latter). Never render it raw.
  condition?: unknown;
  priority?: number;
  async?: boolean;
  description?: string;
  [key: string]: unknown;
}

/** The human-readable CEL source of a hook condition, whatever shape it took. */
function conditionText(condition: unknown): string {
  if (!condition) return '';
  if (typeof condition === 'string') return condition;
  if (typeof condition === 'object') {
    const src = (condition as { source?: unknown }).source;
    if (typeof src === 'string') return src;
  }
  return '';
}

/** Does this hook's `object` target match the object we're viewing? */
function targetsObject(hook: HookItem, objectName: string): boolean {
  const target = hook.object;
  if (target === '*') return true;
  if (typeof target === 'string') return target === objectName;
  if (Array.isArray(target)) return target.includes(objectName) || target.includes('*');
  return false;
}

export function ObjectHooksPanel({
  objectName,
  packageId,
}: {
  objectName: string;
  packageId: string;
}) {
  const locale = useMetadataLocale();
  const client = useMetadataClient();
  const [hooks, setHooks] = React.useState<HookItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = (await client.list('hook', { packageId })) as HookItem[];
        if (cancelled) return;
        setHooks((list || []).filter((h) => targetsObject(h, objectName)));
      } catch (e) {
        if (!cancelled) setError(formatMetadataError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, packageId, objectName]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <p className="text-[11px] leading-5 text-muted-foreground">{t('engine.studio.hooks.explain', locale)}</p>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-[11px] text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="px-1 py-6 text-center text-[11px] text-muted-foreground">{t('engine.studio.loading', locale)}</p>
      ) : hooks.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11px] leading-5 text-muted-foreground">{t('engine.studio.hooks.none', locale)}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {hooks.map((h) => (
            <div key={h.name} className="rounded-lg border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Webhook className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{h.label || h.name}</span>
                {h.object === '*' && (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {t('engine.studio.hooks.wildcard', locale)}
                  </span>
                )}
                {h.async && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    {t('engine.studio.hooks.async', locale)}
                  </span>
                )}
              </div>

              {Array.isArray(h.events) && h.events.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {h.events.map((ev) => (
                    <span key={ev} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {ev}
                    </span>
                  ))}
                </div>
              )}

              {conditionText(h.condition) && (
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {t('engine.studio.hooks.condition', locale)}{' '}
                  <code className="rounded bg-muted px-1">{conditionText(h.condition)}</code>
                </p>
              )}

              <p className="mt-1.5 text-[10px] text-muted-foreground">
                {tFormat('engine.studio.hooks.meta', locale, { priority: h.priority ?? 100 })}
                {' · '}
                {t('engine.studio.hooks.code', locale)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
