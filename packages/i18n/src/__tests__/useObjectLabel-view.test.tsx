import { describe, it, expect, vi, afterEach } from 'vitest';
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

/** Same provider, with the dev missing-key warner explicitly on. */
const warningWrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(
    I18nProvider,
    {
      config: { defaultLanguage: 'en', detectBrowserLanguage: false, warnMissingKeys: true },
    },
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

/**
 * objectstack#5164 ruling A (2026-08-06): the canonical `_views` translation key
 * is the runtime view identity's BARE name. The extractor now derives it from the
 * view composer (objectstack#6124) and `packages/lint` enforces that one spelling
 * (objectstack#6038); this resolver used to additionally accept the prefixed full
 * name (`_views.<objectName>.<viewName>`) as a second candidate, which made the
 * Console show a translated label while the server-side resolver — which reads the
 * one key only (objectstack#5165) — still served English to every consumer that
 * does not re-resolve (REST, mobile, plain HTTP, SDUI).
 *
 * These pin BOTH directions of the narrowing: the bare key resolves, and the
 * prefixed spelling falls through to the metadata default on every surface that
 * goes through `viewSuffixes` (label / description / emptyState).
 */
describe('useObjectLabel() view keys — bare-key-only resolution (objectui#3502)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not resolve a view translation authored under the prefixed full name', () => {
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
                // The rejected spelling: the view name still carries its object
                // prefix, so the bundle nests `crm_opportunity` under `_views`.
                crm_opportunity: {
                  pipeline_kanban: {
                    label: 'Prefixed pipeline',
                    description: 'Prefixed pipeline description',
                    emptyState: {
                      title: 'Prefixed empty title',
                      message: 'Prefixed empty message.',
                    },
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
    ).toBe('Sales Pipeline');
    expect(
      result.current.labels.viewDescription(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        'Manage opportunities by stage',
      ),
    ).toBe('Manage opportunities by stage');
    expect(
      result.current.labels.viewEmptyState(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        { title: 'No opportunities', message: 'Create one to begin.' },
      ),
    ).toEqual({
      title: 'No opportunities',
      message: 'Create one to begin.',
    });
  });

  it('resolves the bare key even when a prefixed sibling exists', () => {
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
                pipeline_kanban: { label: 'Bare pipeline' },
                crm_opportunity: {
                  pipeline_kanban: { label: 'Prefixed pipeline' },
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
    ).toBe('Bare pipeline');
  });

  it('keeps the object-name axis: a short-object-name bundle still resolves', () => {
    const { result } = renderHook(
      () => ({ labels: useObjectLabel(), i18n: useObjectTranslation().i18n }),
      { wrapper },
    );
    // Only the view axis was narrowed. The object axis (namespaced name first,
    // then the `__`-stripped base name) is a separate fallback and stays.
    result.current.i18n.addResourceBundle(
      'en',
      'translation',
      {
        crm: {
          objects: {
            opportunity: {
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
        'crm__opportunity',
        'crm__opportunity.pipeline_kanban',
        'Sales Pipeline',
      ),
    ).toBe('Localized pipeline');
    // A runtime id qualified with the short object name strips just as well.
    expect(
      result.current.labels.viewLabel(
        'crm__opportunity',
        'opportunity.pipeline_kanban',
        'Sales Pipeline',
      ),
    ).toBe('Localized pipeline');
  });

  it('falls back visibly on screen, without adding dev-console noise', () => {
    // "Loud" here means the on-screen label is the untranslated metadata default
    // on EVERY consumer, not a Console-only success. The dev missing-key warner
    // stays out of it by design: convention probes carry `I18N_PROBE_FLAG`
    // (see `i18n.ts`) because they miss on every app that authored no view
    // translations at all, so warning here would fire on the healthy path rather
    // than the broken one. A `_views` key written under the rejected spelling is
    // reported at authoring time by `os lint` (`translation-target-unknown`,
    // objectstack#6038) — at the producer, per contract-first.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(
      () => ({ labels: useObjectLabel(), i18n: useObjectTranslation().i18n }),
      { wrapper: warningWrapper },
    );
    result.current.i18n.addResourceBundle(
      'en',
      'translation',
      {
        crm: {
          objects: {
            crm_opportunity: {
              _views: {
                crm_opportunity: { pipeline_kanban: { label: 'Prefixed pipeline' } },
              },
            },
          },
        },
      },
      true,
      true,
    );
    warnSpy.mockClear();

    expect(
      result.current.labels.viewLabel(
        'crm_opportunity',
        'crm_opportunity.pipeline_kanban',
        'Sales Pipeline',
      ),
    ).toBe('Sales Pipeline');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
