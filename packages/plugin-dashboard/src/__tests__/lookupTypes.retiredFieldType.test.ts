/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Items 8 and 9 of objectui#4914 — `computeLookupExpand`'s `$expand` whitelist
 * and `isLookupType`, behind the retirement gate (maintainer ruling B).
 *
 * Both were measured live before the ruling (comment 5324769751):
 *
 *   - `computeLookupExpand` ACTIVELY requested `$expand` for a
 *     `record_owner: { type: 'owner' }` column — the retired spelling holding
 *     the full relational read path;
 *   - `isLookupType('owner') === true`, at exactly the same level as
 *     `isLookupType('reference') === true`.
 *
 * ## What the refusal costs, stated rather than hidden
 *
 * Refusing `$expand` means the cell shows the raw foreign-key id. That is the
 * degradation the premise-gate measurement objected to — and the objection was
 * to its SILENCE. The gate keeps the degradation and adds the missing half: the
 * author is told, once, with the migration prescription, at the moment the
 * renderer stops resolving the reference. A column whose editor already answers
 * with a tombstone was never going to render its reference for long.
 *
 * Ablation direction, predicted before running: drop the gate from either face
 * and that face's refusal pin goes RED (`isLookupType` returning true; the
 * accessor reappearing in the expand list) while the `reference`/`user`
 * controls stay green in both directions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RETIRED_FIELD_TYPES, resetRetiredFieldTypeReports } from '@object-ui/core';
import { isLookupType } from '../recordFields';
import { computeLookupExpand } from '../ObjectDataTable';

const RETIRED = Object.keys(RETIRED_FIELD_TYPES)[0];

/**
 * Relations that were never retired. `reference` is the load-bearing one: it is
 * as absent from the spec's closed `FieldType` as the retired spelling is, and
 * it is a deliberate compatibility member — the measurement's reductio, here as
 * a control.
 */
const LIVE_RELATIONS = ['lookup', 'reference', 'master_detail', 'user'] as const;

const objectSchema = (ownerType: string) => ({
  fields: {
    id: { type: 'text' },
    account: { type: 'lookup', reference: 'accounts' },
    assignee: { type: 'user' },
    record_owner: { type: ownerType },
    title: { type: 'text' },
  },
});

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetRetiredFieldTypeReports();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  resetRetiredFieldTypeReports();
});

describe('`isLookupType` — item 9', () => {
  it('still answers true for every live relation, silently', () => {
    // NON-VACUITY CONTROL. `reference` in particular: if the gate had been
    // written as "not in the spec enum" rather than "in the retirement table",
    // this line is what goes red.
    for (const live of LIVE_RELATIONS) {
      expect(isLookupType(live), live).toBe(true);
    }
    expect(isLookupType('text')).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('answers false for a retired spelling, where it used to answer true', () => {
    expect(isLookupType(RETIRED)).toBe(false);
    // The comparison the measurement made: it sat at `reference`'s level.
    expect(isLookupType(RETIRED)).not.toBe(isLookupType('reference'));
  });

  it('tolerates the non-string inputs its signature accepts', () => {
    expect(isLookupType(undefined)).toBe(false);
    expect(isLookupType(null)).toBe(false);
    expect(isLookupType(42)).toBe(false);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('closes the CLASS — quantified over the table', () => {
    for (const spelling of Object.keys(RETIRED_FIELD_TYPES)) {
      expect(isLookupType(spelling), spelling).toBe(false);
    }
  });
});

describe('`computeLookupExpand` — item 8', () => {
  it('still expands the live relations, in both column modes', () => {
    // NON-VACUITY CONTROL: the auto-derive mode and the explicit-whitelist mode
    // are two separate code paths through the predicate, so both are exercised
    // before anything is asserted absent.
    const auto = computeLookupExpand({}, objectSchema('user'));
    expect(auto).toEqual(expect.arrayContaining(['account', 'assignee', 'record_owner']));

    const explicit = computeLookupExpand(
      { columns: ['account', 'record_owner', 'title'] },
      objectSchema('user'),
    );
    expect(explicit).toEqual(expect.arrayContaining(['account', 'record_owner']));
    expect(explicit).not.toContain('title');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('drops the retired column from `$expand` in auto-derive mode', () => {
    const out = computeLookupExpand({}, objectSchema(RETIRED));
    expect(out).not.toContain('record_owner');
    // The other two relations must survive, or the refusal took the whole
    // whitelist with it.
    expect(out).toEqual(expect.arrayContaining(['account', 'assignee']));
  });

  it('drops it from an explicit column whitelist too', () => {
    const out = computeLookupExpand(
      { columns: ['account', 'record_owner'] },
      objectSchema(RETIRED),
    );
    expect(out).toEqual(['account']);
  });

  it('says why exactly once, across both modes and every column', () => {
    computeLookupExpand({}, objectSchema(RETIRED));
    computeLookupExpand({ columns: ['record_owner'] }, objectSchema(RETIRED));
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(RETIRED_FIELD_TYPES[RETIRED]);
  });
});
