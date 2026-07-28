// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * CloudAiModelStatus — a read-only admin diagnostic panel, registered as the
 * SDUI widget `cloud:ai-model-status`.
 *
 * Answers, at a glance, the question that used to need a Cloudflare token and a
 * sys_ai_model table read: "which AI model is THIS environment's build/ask loop
 * actually using, and why — a code default, or an env override pinning it?"
 *
 * It fetches the live per-env truth from `GET /api/v1/ai/effective-model`
 * (service-ai, cloud#797) — the endpoint reads the running adapter, so this
 * panel never re-computes the model (a second compute source is exactly the
 * drift trap the boot-convergence guard fixed). The component owns only the
 * fetch + render; the endpoint path comes from page metadata `properties`, so
 * the Cloud/Setup page owns its URL. Same pattern as `cloud:onboarding-next`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Badge, Skeleton } from '@object-ui/components';
import { createAuthenticatedFetch } from '@object-ui/auth';
import { ComponentRegistry } from '@object-ui/core';
import { useObjectTranslation } from '@object-ui/i18n';

type TFn = (key: string, vars?: Record<string, unknown>) => string;

interface EffectiveModelReport {
  conversational: { model?: string; source: string };
  structured: { model?: string; pinned: boolean; source: string };
  reasoningEffort: { effective: string; source: string };
  adapter: string;
  provider?: string;
  overrides: Record<string, string | null>;
  summary: string;
}

interface CloudAiModelStatusProps {
  properties?: {
    /** Effective-model endpoint (env-runtime, service-ai). Defaults below. */
    effectiveModelUrl?: string;
  };
}

const DEFAULT_URL = '/api/v1/ai/effective-model';

type Phase =
  | { phase: 'loading' }
  | { phase: 'ready'; report: EffectiveModelReport }
  | { phase: 'error'; status?: number };

/** Env-override source → a friendly label; `code-default` reads as such. */
function sourceLabel(source: string, t: TFn): string {
  if (source === 'code-default') return t('aiModelStatus.sourceCodeDefault');
  if (source === 'inherits-conversational') return t('aiModelStatus.sourceInherits');
  if (source.startsWith('env:')) return t('aiModelStatus.sourcePinned', { source: source.slice(4) });
  return source;
}

/** `code-default` is the calm state; any env pin is worth a highlight. */
function sourceTone(source: string): 'secondary' | 'default' {
  return source.startsWith('env:') ? 'default' : 'secondary';
}

function useEffectiveModel(url: string): Phase {
  const authFetch = useMemo(() => createAuthenticatedFetch(), []);
  const [state, setState] = useState<Phase>({ phase: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const apiBase = ((import.meta as any).env?.VITE_SERVER_URL || '').replace(/\/+$/, '');
    (async () => {
      try {
        const res = await authFetch(`${apiBase}${url}`, { method: 'GET', credentials: 'include' });
        if (!res.ok) {
          if (!cancelled) setState({ phase: 'error', status: res.status });
          return;
        }
        const json = await res.json().catch(() => null);
        const report = (json?.data ?? json) as EffectiveModelReport | null;
        if (cancelled) return;
        if (!report || typeof report !== 'object' || !report.conversational) {
          setState({ phase: 'error' });
          return;
        }
        setState({ phase: 'ready', report });
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, url]);

  return state;
}

/** One labelled row: dimension name, the resolved model, and a source badge. */
function ModelRow({ label, model, source, t }: { label: string; model?: string; source: string; t: TFn }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-border last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <code className="text-sm font-medium">{model ?? '—'}</code>
        <Badge variant={sourceTone(source)}>{sourceLabel(source, t)}</Badge>
      </span>
    </div>
  );
}

export function CloudAiModelStatus({ properties }: CloudAiModelStatusProps) {
  const { t } = useObjectTranslation();
  const url = properties?.effectiveModelUrl || DEFAULT_URL;
  const state = useEffectiveModel(url);

  if (state.phase === 'loading') {
    return (
      <div className="space-y-2" data-ai-model-status="loading">
        <Skeleton className="h-5 w-3/4 rounded" />
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-10 w-full rounded" />
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="text-sm text-muted-foreground" data-ai-model-status="error">
        {state.status
          ? t('aiModelStatus.readFailedWithStatus', { status: state.status })
          : t('aiModelStatus.readFailed')}
      </div>
    );
  }

  const { report } = state;
  const setOverrides = Object.entries(report.overrides).filter(([, v]) => v != null);

  return (
    <div className="space-y-4" data-ai-model-status="ready">
      <p className="text-sm text-foreground">{report.summary}</p>

      <div className="rounded-md border border-border px-3">
        <ModelRow
          label={t('aiModelStatus.rowConversational')}
          t={t}
          model={report.conversational.model}
          source={report.conversational.source}
        />
        <ModelRow
          label={t('aiModelStatus.rowStructured')}
          t={t}
          model={report.structured.model}
          source={report.structured.source}
        />
        <ModelRow
          label={t('aiModelStatus.rowReasoning')}
          t={t}
          model={report.reasoningEffort.effective}
          source={report.reasoningEffort.source}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{t('aiModelStatus.overridesInEffect')}</span>
        {setOverrides.length === 0 ? (
          <span>{t('aiModelStatus.noOverrides')}</span>
        ) : (
          <code>{setOverrides.map(([k, v]) => `${k}=${v}`).join('  ·  ')}</code>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t('aiModelStatus.adapter')}
        <code>{report.adapter}{report.provider ? ` / ${report.provider}` : ''}</code>
      </p>
    </div>
  );
}

ComponentRegistry.register('cloud:ai-model-status', (props: CloudAiModelStatusProps) => (
  <CloudAiModelStatus {...props} />
), {
  namespace: 'app-shell',
  label: 'Cloud AI Model Status',
  category: 'plugin',
  inputs: [],
});
