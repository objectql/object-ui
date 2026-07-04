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
});
