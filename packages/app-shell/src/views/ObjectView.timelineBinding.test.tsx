/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#3129 — the object page must not invent a timeline date axis.
 *
 * This face used to emit `startDateField: 'due_date'` into `options.timeline`
 * for EVERY object view, declared or not. Downstream that is indistinguishable
 * from a real binding, and because it is always present it shadowed the
 * calendar binding `ListView.resolveTimelineDateBinding` falls back to — so a
 * calendar-bound view rendered as a timeline bucketed every record into
 * "No date" (the reported symptom), while the calendar rendered the same field
 * correctly.
 *
 * REVERSE VERIFICATION — direction predicted before running, then observed:
 * restore `startDateField: viewDef.timeline?.startDateField || … || 'due_date'`
 * in `timelineViewOptions` and the two "does not invent" cases below go RED
 * (they read `'due_date'`), while every other case in this file and in
 * `ListView.timeline-binding.test.tsx` stays green — the fabricated value is
 * only ever observable when the view declared nothing.
 */

import { describe, it, expect } from 'vitest';
import { timelineViewOptions } from './ObjectView';

const objectDef = { name: 'crm_campaign', titleField: 'name' };

describe('timelineViewOptions — the object page forwards, it does not resolve (#3129)', () => {
  it('forwards a declared spec binding untouched', () => {
    const out = timelineViewOptions(
      { timeline: { startDateField: 'start_date', endDateField: 'end_date', scale: 'month' } },
      objectDef,
    );
    expect(out.startDateField).toBe('start_date');
    expect(out.endDateField).toBe('end_date');
    // Every spec key survives — the whole config is spread, not whitelisted.
    expect(out.scale).toBe('month');
  });

  it('promotes the legacy `dateField` alias onto the spec key', () => {
    expect(timelineViewOptions({ timeline: { dateField: 'start_date' } }, objectDef).startDateField)
      .toBe('start_date');
  });

  it('invents NO date field when the view declares none', () => {
    const out = timelineViewOptions({ timeline: { titleField: 'campaign_name' } }, objectDef);
    expect(out.startDateField).toBeUndefined();
    expect(out.titleField).toBe('campaign_name');
  });

  it('invents NO date field for a view with no timeline config at all', () => {
    // The calendar-bound view from the report: the axis lives under `calendar`,
    // and leaving `startDateField` absent here is what lets ListView find it.
    const out = timelineViewOptions({ calendar: { startDateField: 'start_date' } }, objectDef);
    expect(out.startDateField).toBeUndefined();
    // The object's declared title field is the one thing this layer still
    // contributes — ListView has no access to objectDef.
    expect(out.titleField).toBe('name');
  });

  it("falls back to 'name' when the object declares no titleField", () => {
    expect(timelineViewOptions({}, { name: 'crm_campaign' }).titleField).toBe('name');
  });
});
