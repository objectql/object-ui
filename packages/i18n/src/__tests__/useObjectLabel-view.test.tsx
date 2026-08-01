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

describe('useObjectLabel().viewLabel', () => {
  it('resolves an authored view translation from a qualified runtime view id', () => {
    const { result } = renderHook(
      () => ({ labels: useObjectLabel(), i18n: useObjectTranslation().i18n }),
      { wrapper },
    );
    result.current.i18n.addResourceBundle(
      'en',
      'translation',
      {
        crm: {
          objects: {
            crm_opportunity: {
              _views: {
                pipeline_kanban: {
                  label: 'Localized pipeline',
                  description: 'Localized pipeline description',
                  emptyState: {
                    title: 'No localized records',
                    message: 'Create a localized record to begin.',
                  },
                },
              },
            },
          },
        },
      },
      true,
      true,
    );

    expect(
      result.current.labels.viewLabel(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        'Sales Pipeline',
      ),
    ).toBe('Localized pipeline');
    expect(
      result.current.labels.viewDescription(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        'Manage opportunities by stage',
      ),
    ).toBe('Localized pipeline description');
    expect(
      result.current.labels.viewEmptyState(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        { title: 'No opportunities', message: 'Create one to begin.' },
      ),
    ).toEqual({
      title: 'No localized records',
      message: 'Create a localized record to begin.',
    });
  });

  it('continues to resolve an unqualified authored view name', () => {
    const { result } = renderHook(
      () => ({ labels: useObjectLabel(), i18n: useObjectTranslation().i18n }),
      { wrapper },
    );
    result.current.i18n.addResourceBundle(
      'en',
      'translation',
      {
        crm: {
          objects: {
            crm_opportunity: {
              _views: {
                pipeline_kanban: { label: 'Localized pipeline' },
              },
            },
          },
        },
      },
      true,
      true,
    );

    expect(
      result.current.labels.viewLabel(
        'crm_opportunity',
        'pipeline_kanban',
        'Sales Pipeline',
      ),
    ).toBe('Localized pipeline');
  });
});
