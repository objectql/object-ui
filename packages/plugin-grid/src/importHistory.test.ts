import { describe, it, expect } from 'vitest';
import { __testables } from './ImportWizard';
import type { ImportJobStatus } from '@object-ui/types';

const { isImportJobActive } = __testables;

describe('isImportJobActive', () => {
  it('is true only while a job is still in flight', () => {
    expect(isImportJobActive('pending')).toBe(true);
    expect(isImportJobActive('running')).toBe(true);
  });

  it('is false for every terminal status', () => {
    const terminal: ImportJobStatus[] = ['succeeded', 'failed', 'cancelled'];
    for (const s of terminal) expect(isImportJobActive(s)).toBe(false);
  });
});
