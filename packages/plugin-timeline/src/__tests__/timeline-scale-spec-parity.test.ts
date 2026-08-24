/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Timeline scale ↔ spec vocabulary parity + behavior (#2942).
 *
 * Two drifts lived here: the renderer read its own `timeScale` key, so the
 * spec's `scale` (`TimelineConfigSchema`) was ignored for ALL six values;
 * and the header generator only knew month/week/day, so `hour` / `quarter` /
 * `year` produced zero header columns — a blank gantt axis.
 */
import { describe, it, expect } from 'vitest';
import { TimelineConfigSchema } from '@objectstack/spec/ui';
import { shapeEnumOptions } from '@object-ui/test-support';
import { TIMELINE_SCALES, resolveTimelineScale, generateTimeScaleHeaders } from '../renderer';

describe('timeline covers the spec scale vocabulary', () => {
  const specNames = shapeEnumOptions(TimelineConfigSchema, 'scale');

  it('reads a non-empty enum from the spec', () => {
    expect(specNames, 'could not read TimelineConfigSchema.shape.scale options from the spec').not.toEqual([]);
  });

  it('declares exactly the spec scales', () => {
    expect([...TIMELINE_SCALES].sort()).toEqual([...specNames].sort());
  });

  it('every spec scale generates a non-empty gantt header row', () => {
    for (const scale of specNames) {
      const headers = generateTimeScaleHeaders(scale, '2026-01-01', '2026-01-02');
      expect(headers.length, `scale '${scale}' blanked the axis`).toBeGreaterThan(0);
    }
  });

  it('quarter and year headers read as buckets, not blanks', () => {
    expect(generateTimeScaleHeaders('quarter', '2026-01-15', '2026-08-01')).toEqual(['Q1 2026', 'Q2 2026', 'Q3 2026']);
    expect(generateTimeScaleHeaders('year', '2025-06-01', '2027-01-01')).toEqual(['2025', '2026', '2027']);
  });
});

describe('resolveTimelineScale honors the spec key first', () => {
  it('reads the spec `scale` key', () => {
    expect(resolveTimelineScale({ scale: 'quarter' })).toBe('quarter');
  });

  it('keeps the legacy `timeScale` dialect for stored JSON', () => {
    expect(resolveTimelineScale({ timeScale: 'day' })).toBe('day');
  });

  it('the spec key wins when both are present', () => {
    expect(resolveTimelineScale({ scale: 'year', timeScale: 'day' })).toBe('year');
  });

  it("absent/unknown values keep the renderer's historical month default", () => {
    expect(resolveTimelineScale({})).toBe('month');
    expect(resolveTimelineScale({ scale: 'fortnight' })).toBe('month');
  });
});
