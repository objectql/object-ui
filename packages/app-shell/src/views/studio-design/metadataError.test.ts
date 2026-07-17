// Copyright (c) 2026 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import { extractIssues, formatMetadataError, formatPublishFailures } from './metadataError';

describe('formatMetadataError', () => {
  it('lists field-anchored issues, one per line, when the error carries them', () => {
    const err = Object.assign(new Error('[invalid_metadata] object/bad failed spec validation: ...'), {
      issues: [
        { path: 'fields.amount.type', message: 'Required' },
        { path: 'label', message: 'Required' },
      ],
    });
    expect(formatMetadataError(err)).toBe(
      '• fields.amount.type — Required\n• label — Required',
    );
  });

  it('labels a root-level issue (empty path) as (root)', () => {
    const err = Object.assign(new Error('bad'), { issues: [{ path: '', message: 'Must have a name' }] });
    expect(formatMetadataError(err)).toBe('• (root) — Must have a name');
  });

  it('falls back to the plain message when there are no issues', () => {
    expect(formatMetadataError(new Error('Save failed: network'))).toBe('Save failed: network');
  });

  it('stringifies a non-Error throw', () => {
    expect(formatMetadataError('boom')).toBe('boom');
  });
});

describe('extractIssues', () => {
  it('returns the issues array, or empty for none / non-arrays', () => {
    expect(extractIssues({ issues: [{ path: 'a', message: 'b' }] })).toHaveLength(1);
    expect(extractIssues(new Error('x'))).toEqual([]);
    expect(extractIssues({ issues: 'nope' })).toEqual([]);
    expect(extractIssues(null)).toEqual([]);
  });
});

describe('formatPublishFailures', () => {
  it('heads each failed draft and indents its field-anchored issues', () => {
    const out = formatPublishFailures([
      {
        type: 'object',
        name: 'invoice',
        error: 'failed spec validation',
        issues: [{ path: 'fields.total.type', message: 'Required' }],
      },
      { type: 'flow', name: 'notify', error: 'start node missing' },
    ]);
    expect(out).toBe(
      'object/invoice: failed spec validation\n  • fields.total.type — Required\n' +
        'flow/notify: start node missing',
    );
  });

  // framework 15.1+ (ADR-0067 D2) — the batch is all-or-nothing; `failed[]`
  // carries the causal item + batch_aborted markers for the rolled-back rest.
  it('15.1+ all-or-nothing: one rolled-back banner anchored on the causal item', () => {
    const out = formatPublishFailures([
      { type: 'object', name: 'crm_lead', error: 'not published — the batch is all-or-nothing…', code: 'batch_aborted' },
      {
        type: 'object', name: 'crm_deal', error: 'failed spec validation', code: 'invalid_metadata',
        issues: [{ path: 'fields.amount.type', message: 'Required' }],
      },
      { type: 'view', name: 'lead_list', error: 'not published — …', code: 'batch_aborted' },
    ]);
    expect(out).toContain('Nothing was published — the batch rolled back');
    // causal item with its real error and field-anchored issues…
    expect(out).toContain('object/crm_deal: failed spec validation');
    expect(out).toContain('fields.amount.type — Required');
    // …aborted entries summarized, not listed as parallel errors
    expect(out).not.toContain('crm_lead: not published');
    expect(out).toContain('2 other drafts aborted with it');
  });

  it('all entries aborted (defensive): banner still renders with one sample', () => {
    const out = formatPublishFailures([
      { type: 'object', name: 'a', error: 'not published — …', code: 'batch_aborted' },
      { type: 'object', name: 'b', error: 'not published — …', code: 'batch_aborted' },
    ]);
    expect(out).toContain('Nothing was published');
    expect(out).toContain('object/a');
  });
});
