/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// Mutable host translation table the mock resolves against. i18next returns the
// raw key on a miss, so the mock mirrors that contract.
let hostDict: Record<string, string> = {};
const hostT = (key: string) => hostDict[key] ?? key;

vi.mock('@object-ui/react', () => ({
  useObjectTranslation: () => ({ t: hostT, language: 'zh' }),
}));

import { useGanttTranslation, GANTT_DEFAULT_TRANSLATIONS } from './useGanttTranslation';

describe('useGanttTranslation per-key fallback', () => {
  beforeEach(() => {
    hostDict = {};
  });

  it('uses the host translation when the key is present', () => {
    hostDict = { 'gantt.linkType.fs': '完成 → 开始' };
    const { result } = renderHook(() => useGanttTranslation());
    expect(result.current.t('gantt.linkType.fs')).toBe('完成 → 开始');
  });

  it('falls back to bundled default ONLY for keys the host is missing (partial dictionary)', () => {
    // The exact os-tianshun-ehr symptom: a host that translates the *common*
    // gantt keys but lags on newer ones. The all-or-nothing probe would trust
    // the host for everything and leak raw keys like `gantt.linkType.fs`.
    hostDict = { 'gantt.column.taskName': '任务名称' };
    const { result } = renderHook(() => useGanttTranslation());
    const { t } = result.current;
    // Present in host → host wins.
    expect(t('gantt.column.taskName')).toBe('任务名称');
    // Missing in host → bundled English default, NOT the raw key.
    expect(t('gantt.linkType.fs')).toBe(GANTT_DEFAULT_TRANSLATIONS['gantt.linkType.fs']);
    expect(t('gantt.menu.removeDependency')).toBe(
      GANTT_DEFAULT_TRANSLATIONS['gantt.menu.removeDependency'],
    );
    // Never the raw key.
    expect(t('gantt.linkType.fs')).not.toBe('gantt.linkType.fs');
  });

  it('threads the host language through', () => {
    const { result } = renderHook(() => useGanttTranslation());
    expect(result.current.language).toBe('zh');
  });
});
