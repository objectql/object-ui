/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Data pillar — API view.
 *
 * A truthful, schema-derived REST reference for the selected object. The
 * platform auto-generates five CRUD endpoints per object under
 * `/api/v1/data/<object>` (list / create / get / update / delete) — the same
 * set the classic Studio's API Console surfaces, here scoped to the one object
 * you're looking at so the context is already pinned.
 *
 * Deliberately read-only / reference-only: live execution + auth (choosing a
 * token, impersonating a role, actually firing a write) is a cross-object,
 * cross-cutting concern that belongs in a global Developer console, not on a
 * per-object tab. This panel derives its example body from the object's DRAFT
 * fields, so it stays in sync with unpublished schema edits.
 */

import React from 'react';
import { Copy, Check } from 'lucide-react';
import { readFields } from '../metadata-admin/previews/object-fields-io';
import { t, useMetadataLocale } from '../metadata-admin/i18n';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

const METHOD_STYLE: Record<Method, string> = {
  GET: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  POST: 'bg-sky-500/15 text-sky-600 dark:text-sky-300',
  PATCH: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  DELETE: 'bg-destructive/15 text-destructive',
};

/** Placeholder value for an example request body, keyed off the field type. */
function placeholderFor(type: unknown): unknown {
  switch (type) {
    case 'number':
    case 'currency':
    case 'percent':
      return 0;
    case 'boolean':
      return true;
    case 'date':
      return '2024-01-01';
    case 'datetime':
      return '2024-01-01T00:00:00Z';
    case 'lookup':
    case 'master_detail':
      return 'related_record_id';
    default:
      return 'string';
  }
}

/** A small, honest example body from the object's writable draft fields. */
function buildExampleBody(fields: unknown): Record<string, unknown> {
  const entries = readFields(fields).entries;
  const skip = new Set(['autonumber', 'formula', 'summary']);
  const body: Record<string, unknown> = {};
  for (const e of entries) {
    const def = e.def as Record<string, unknown>;
    if (skip.has(String(def.type))) continue;
    if (def.readonly === true || def.hidden === true) continue;
    body[e.name] = placeholderFor(def.type);
    if (Object.keys(body).length >= 8) break;
  }
  return body;
}

export function ObjectApiPanel({
  name,
  draft,
}: {
  name: string;
  draft: Record<string, unknown>;
}) {
  const locale = useMetadataLocale();
  const [copied, setCopied] = React.useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-host';
  const base = `/api/v1/data/${name}`;
  const exampleBody = React.useMemo(() => buildExampleBody(draft.fields), [draft.fields]);
  const bodyJson = JSON.stringify(exampleBody, null, 2);

  const endpoints: Array<{ id: string; method: Method; path: string; desc: string; body?: boolean }> = [
    { id: 'list', method: 'GET', path: base, desc: t('engine.studio.api.list', locale) },
    { id: 'create', method: 'POST', path: base, desc: t('engine.studio.api.create', locale), body: true },
    { id: 'get', method: 'GET', path: `${base}/{id}`, desc: t('engine.studio.api.get', locale) },
    { id: 'update', method: 'PATCH', path: `${base}/{id}`, desc: t('engine.studio.api.update', locale), body: true },
    { id: 'delete', method: 'DELETE', path: `${base}/{id}`, desc: t('engine.studio.api.delete', locale) },
  ];

  const curlFor = (ep: (typeof endpoints)[number]) => {
    const lines = [`curl -X ${ep.method} '${origin}${ep.path}'`, `  -H 'Authorization: Bearer <token>'`];
    if (ep.body) {
      lines.push(`  -H 'Content-Type: application/json'`);
      lines.push(`  -d '${JSON.stringify(exampleBody)}'`);
    }
    return lines.join(' \\\n');
  };

  const copy = (id: string, text: string) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
      <p className="text-[11px] leading-5 text-muted-foreground">{t('engine.studio.api.subtitle', locale)}</p>

      <div className="flex flex-col gap-2">
        {endpoints.map((ep) => (
          <div key={ep.id} className="rounded-lg border">
            <div className="flex items-center gap-2 px-3 py-2">
              <span className={'shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ' + METHOD_STYLE[ep.method]}>
                {ep.method}
              </span>
              <code className="min-w-0 flex-1 truncate text-[12px]">{ep.path}</code>
              <span className="hidden shrink-0 text-[11px] text-muted-foreground sm:inline">{ep.desc}</span>
              <button
                type="button"
                onClick={() => copy(ep.id, curlFor(ep))}
                title={t('engine.studio.api.copyCurl', locale)}
                className="inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] hover:bg-muted"
              >
                {copied === ep.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied === ep.id ? t('engine.studio.api.copied', locale) : 'cURL'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {Object.keys(exampleBody).length > 0 && (
        <div className="rounded-lg border">
          <header className="border-b px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            {t('engine.studio.api.body', locale)}
          </header>
          <pre className="overflow-auto px-3 py-2 text-[11px] leading-5">{bodyJson}</pre>
        </div>
      )}
    </div>
  );
}
