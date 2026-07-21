import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { I18nProvider, useObjectTranslation } from '../provider';
import { useObjectLabel } from '../useObjectLabel';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    I18nProvider,
    { config: { defaultLanguage: 'en', detectBrowserLanguage: false } },
    children,
  );

/**
 * Regression for objectui#3372 — a globalAction surfaced on a record-detail
 * action bar (where the caller passes `objectDef.name` for every action) must
 * still pick up its `globalActions.<action>.*` overlay when no object-scoped
 * translation exists. Mirrors the canonical `@objectstack/spec` resolver
 * (`lookupActionField`): object-scoped wins, global is the fallback.
 */
describe('useObjectLabel() globalAction fallback (objectui#3372)', () => {
  const setup = () => {
    const { result } = renderHook(
      () => ({ labels: useObjectLabel(), i18n: useObjectTranslation().i18n }),
      { wrapper },
    );
    result.current.i18n.addResourceBundle(
      'en',
      'translation',
      {
        crm: {
          // Object translations present → namespace is discovered via `objects`.
          objects: {
            crm_case: {
              _actions: {
                // Object action — translated under the object scope.
                escalate_case: { label: '升级工单' },
                // A name that exists in BOTH scopes — object must win.
                shared_action: { label: '对象级' },
              },
            },
          },
          // Global action — translated only under the global scope.
          globalActions: {
            log_call: { label: '记录通话', successMessage: '通话记录成功！' },
            shared_action: { label: '全局级' },
          },
        },
      },
      true,
      true,
    );
    return result;
  };

  it('resolves an object action from the object scope (unchanged)', () => {
    const result = setup();
    expect(result.current.labels.actionLabel('crm_case', 'escalate_case', 'Escalate Case')).toBe(
      '升级工单',
    );
  });

  it('resolves a globalAction overlay even when an objectName is passed', () => {
    const result = setup();
    // The bug: with objectName set, `objects.crm_case._actions.log_call.label`
    // misses, so before the fix this leaked the English literal "Log a Call".
    expect(result.current.labels.actionLabel('crm_case', 'log_call', 'Log a Call')).toBe(
      '记录通话',
    );
  });

  it('still resolves a globalAction when objectName is omitted', () => {
    const result = setup();
    expect(result.current.labels.actionLabel(undefined, 'log_call', 'Log a Call')).toBe(
      '记录通话',
    );
  });

  it('prefers the object-scoped translation over the global one on a name collision', () => {
    const result = setup();
    expect(result.current.labels.actionLabel('crm_case', 'shared_action', 'Shared')).toBe(
      '对象级',
    );
  });

  it('falls back to the metadata literal when neither scope translates', () => {
    const result = setup();
    expect(result.current.labels.actionLabel('crm_case', 'unknown_action', 'Do Thing')).toBe(
      'Do Thing',
    );
  });

  it('applies the global fallback to sibling resolvers (successMessage)', () => {
    const result = setup();
    expect(
      result.current.labels.actionSuccess('crm_case', 'log_call', 'Call logged.'),
    ).toBe('通话记录成功！');
  });
});
