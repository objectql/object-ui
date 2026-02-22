/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useState, useEffect, useCallback } from 'react';

export interface UseConfigDraftOptions {
  /** Panel mode: 'create' starts dirty; 'edit' starts clean */
  mode?: 'create' | 'edit';
  /** Optional callback invoked on every field change */
  onUpdate?: (field: string, value: any) => void;
}

export interface UseConfigDraftReturn<T extends Record<string, any>> {
  /** The mutable draft copy */
  draft: T;
  /** Whether the draft differs from the source */
  isDirty: boolean;
  /** Update a single field in the draft */
  updateField: (field: string, value: any) => void;
  /** Revert draft back to source */
  discard: () => void;
  /** Low-level setter (use updateField for individual changes) */
  setDraft: React.Dispatch<React.SetStateAction<T>>;
}

/**
 * Generic draft-state management for configuration panels.
 *
 * Mirrors the proven draft → save / discard pattern from ViewConfigPanel
 * while being reusable across Dashboard, Form, Page, Report, and any
 * future config panel.
 *
 * @param source - The "committed" configuration object.
 * @param options - Optional mode and change callback.
 */
export function useConfigDraft<T extends Record<string, any>>(
  source: T,
  options?: UseConfigDraftOptions,
): UseConfigDraftReturn<T> {
  const [draft, setDraft] = useState<T>({ ...source });
  const [isDirty, setIsDirty] = useState(options?.mode === 'create');

  // Reset draft when source identity changes
  useEffect(() => {
    setDraft({ ...source });
    setIsDirty(options?.mode === 'create');
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateField = useCallback(
    (field: string, value: any) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
      setIsDirty(true);
      options?.onUpdate?.(field, value);
    },
    [options?.onUpdate], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const discard = useCallback(() => {
    setDraft({ ...source });
    setIsDirty(false);
  }, [source]);

  return { draft, isDirty, updateField, discard, setDraft };
}
