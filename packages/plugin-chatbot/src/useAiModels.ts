/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * useAiModels — fetch the AI-model picker allowlist (ADR-0028) from a framework
 * (`@objectstack/service-ai`) backend.
 *
 * Hits `GET {apiBase}/models` (exposed by `buildAgentRoutes`) → the plan-filtered
 * set of models THIS environment offers in the build/ask model picker, plus the
 * default model id. Free / single-model envs return one entry, so the footer
 * picker (which `ChatbotEnhanced` renders only for 2+ models) stays hidden.
 *
 * Intentionally dependency-free (uses `fetch`), mirroring {@link useAgents}.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatbotModelOption } from './ChatbotEnhanced';

export interface UseAiModelsOptions {
  /** Base URL of the AI service, e.g. "http://localhost:3000/api/v1/ai". */
  apiBase?: string;
  /** Additional headers (auth tokens, conversation IDs, etc.). */
  headers?: Record<string, string>;
  /** Disable the fetch (useful while the URL is still resolving). */
  enabled?: boolean;
}

export interface UseAiModelsReturn {
  /** The plan-filtered models offered in the picker. Empty until resolved. */
  models: ChatbotModelOption[];
  /** The default / fallback model id reported by the backend. */
  defaultModelId: string | undefined;
  isLoading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

interface RawModel {
  id?: string;
  label?: string;
  default?: boolean;
  [key: string]: unknown;
}

function normalize(raw: RawModel[]): ChatbotModelOption[] {
  return raw
    .filter((m) => typeof m?.id === 'string' && (m.id as string).length > 0)
    .map((m) => ({ id: m.id as string, label: m.label || (m.id as string) }));
}

/**
 * Fetch the AI-model allowlist for the current environment.
 *
 * @example
 * const { models, defaultModelId } = useAiModels({ apiBase: '/api/v1/ai' });
 */
export function useAiModels(options: UseAiModelsOptions = {}): UseAiModelsReturn {
  const { apiBase, headers, enabled = true } = options;

  const [models, setModels] = useState<ChatbotModelOption[]>([]);
  const [defaultModelId, setDefaultModelId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [reloadToken, setReloadToken] = useState(0);

  // Stash latest headers in a ref so consumers can pass inline objects without
  // triggering a refetch on every render.
  const headersRef = useRef(headers);
  headersRef.current = headers;

  useEffect(() => {
    if (!enabled || !apiBase) return;

    const controller = new AbortController();
    let cancelled = false;

    setIsLoading(true);
    setError(undefined);

    const url = `${apiBase.replace(/\/$/, '')}/models`;
    fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(headersRef.current ?? {}) },
      credentials: 'include',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load AI models (${res.status})`);
        return res.json() as Promise<{ models?: RawModel[]; defaultModel?: string } | RawModel[]>;
      })
      .then((payload) => {
        if (cancelled) return;
        const list = Array.isArray(payload) ? payload : payload?.models ?? [];
        const reportedDefault = Array.isArray(payload) ? undefined : payload?.defaultModel;
        setModels(normalize(list));
        setDefaultModelId(reportedDefault ?? list.find((m) => m?.default)?.id ?? list[0]?.id);
      })
      .catch((err: Error) => {
        if (cancelled || err.name === 'AbortError') return;
        setError(err);
        setModels([]);
        setDefaultModelId(undefined);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [apiBase, enabled, reloadToken]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { models, defaultModelId, isLoading, error, refetch };
}
