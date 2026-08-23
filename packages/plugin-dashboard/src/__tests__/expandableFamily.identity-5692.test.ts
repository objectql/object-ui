/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5692 — this package's TWO private copies of the reference-bearing
 * field family converge onto `@object-ui/core`'s `EXPANDABLE_FIELD_TYPES`.
 *
 * The copies were `LOOKUP_TYPES` in `recordFields.tsx` and an inline
 * disjunction inside `computeLookupExpand` in `ObjectDataTable.tsx`. Neither
 * derived from nor pinned against the shared set, and objectui#5312 had recorded
 * `paramToField` as the LAST private copy — false by these two, which predate
 * that sweep.
 *
 * ## Why the load-bearing pin is IDENTITY, not membership
 *
 * Every membership assertion below is satisfied by a private
 * `new Set(['lookup', 'master_detail', 'tree', 'user'])` holding the same
 * strings — i.e. by a re-fork of exactly the kind this change removed. So the
 * pins that decide the convergence spy on the `has` of the object core exports:
 * a call is recorded only if the face under test consulted THAT object, so a
 * member-identical copy leaves the spy empty and fails here, where a value check
 * would pass ON the defect. Same shape as objectui#4770 / #4790 / #4815 / #5312.
 *
 * ## The two membership deltas, and how each was decided
 *
 * The private copies were not in a subset relation with the shared set in either
 * direction: they lacked `tree` and carried a fifth spelling, `reference`.
 *
 *  - `tree` GAINED (accepted): a member of the spec's closed `FieldType` that
 *    the form / grid road already expands.
 *  - `reference` DROPPED (measured, not preferred): it is not a declarable field
 *    type at all, so no producer can emit a field whose stored type is
 *    `reference`. `describe('the reference drop is a no-op...')` below carries
 *    that measurement — with live and dead controls — so the day the spec adds
 *    the spelling, this file goes RED and the membership question reopens
 *    instead of the drop staying silently correct-by-accident.
 *
 * Ablation direction, predicted before running: restore either private copy and
 * that face's identity pin goes RED (the spy records no call) while its `tree`
 * pin goes red too and its `reference` pin flips; the ordinary-relation
 * regression controls stay GREEN in both directions, which is what makes them
 * controls rather than duplicates of the pins.
 */
import { describe, it, expect, vi } from 'vitest';
import { EXPANDABLE_FIELD_TYPES } from '@object-ui/core';
import { FieldType } from '@objectstack/spec/data';
import { isLookupType } from '../recordFields';
import { computeLookupExpand } from '../ObjectDataTable';

const SPEC_FIELD_TYPES: readonly string[] = [
  ...(FieldType as unknown as { options: readonly string[] }).options,
];

/** The relations an ordinary dashboard table shows — the regression control. */
const ORDINARY_RELATIONS = ['lookup', 'master_detail', 'user'] as const;

const objectSchema = () => ({
  fields: {
    id: { type: 'text' },
    title: { type: 'text' },
    account: { type: 'lookup', reference: 'accounts' },
    parent_case: { type: 'master_detail', reference: 'cases' },
    assignee: { type: 'user' },
    parent_node: { type: 'tree', reference: 'nodes' },
    legacy_ref: { type: 'reference', reference: 'accounts' },
  },
});

const ALL_COLUMNS = [
  'title',
  'account',
  'parent_case',
  'assignee',
  'parent_node',
  'legacy_ref',
];

describe("the dashboard's relation rule is core's object, not a copy (objectui#5692)", () => {
  it('`isLookupType` asks `@object-ui/core` EXPANDABLE_FIELD_TYPES', () => {
    const spy = vi.spyOn(EXPANDABLE_FIELD_TYPES, 'has');
    try {
      expect(isLookupType('lookup')).toBe(true);
      expect(spy.mock.calls.map(([k]) => k)).toContain('lookup');
    } finally {
      spy.mockRestore();
    }
  });

  it('`computeLookupExpand` asks it too — in BOTH column modes', () => {
    // The explicit-whitelist mode and the auto-derive mode are two separate
    // code paths through the predicate, so a convergence that reconnected one
    // would leave the other forked. Each is spied separately.
    const modes: [string, () => unknown][] = [
      ['explicit whitelist', () =>
        computeLookupExpand({ columns: ALL_COLUMNS }, objectSchema())],
      ['auto-derive', () => computeLookupExpand({}, objectSchema())],
    ];
    for (const [label, exercise] of modes) {
      const spy = vi.spyOn(EXPANDABLE_FIELD_TYPES, 'has');
      try {
        exercise();
        expect(
          spy.mock.calls.map(([k]) => k),
          `${label} never consulted the shared set`,
        ).toContain('lookup');
      } finally {
        spy.mockRestore();
      }
    }
  });
});

describe('the ordinary relations are untouched — regression control', () => {
  // These must stay green through BOTH ablation legs. If they move, the
  // convergence took the whole whitelist with it and the pins above are
  // reporting on rubble rather than on a re-homed rule.
  it('`isLookupType` still answers true for every ordinary relation', () => {
    for (const type of ORDINARY_RELATIONS) {
      expect(isLookupType(type), type).toBe(true);
    }
    expect(isLookupType('text')).toBe(false);
  });

  it('`$expand` still carries the ordinary relation columns, in both modes', () => {
    const explicit = computeLookupExpand({ columns: ALL_COLUMNS }, objectSchema());
    const auto = computeLookupExpand({}, objectSchema());
    for (const expanded of [explicit, auto]) {
      expect(expanded).toEqual(
        expect.arrayContaining(['account', 'parent_case', 'assignee']),
      );
      expect(expanded).not.toContain('title');
      expect(expanded).not.toContain('id');
    }
  });
});

describe('`tree` gains expansion on the dashboard road — the accepted direction', () => {
  // A self-referencing hierarchy column is reference-bearing, so the form and
  // grid roads already `$expand` it. The dashboard's private copies did not,
  // which is the divergence this convergence closes; the column's cell shows
  // the parent record's display name instead of a bare id.
  it('is a member of the shared family', () => {
    expect(EXPANDABLE_FIELD_TYPES.has('tree')).toBe(true);
  });

  it('`isLookupType` now answers true for it', () => {
    expect(isLookupType('tree')).toBe(true);
  });

  it('a `tree` column is now requested for `$expand`, in both modes', () => {
    expect(
      computeLookupExpand({ columns: ALL_COLUMNS }, objectSchema()),
    ).toContain('parent_node');
    expect(computeLookupExpand({}, objectSchema())).toContain('parent_node');
  });
});

describe('the `reference` drop is a no-op on real data — the measured direction', () => {
  /**
   * The measurement, kept as an executable pin rather than as prose in a PR.
   * Controls run on the same read as the subject, so a probe that had lost hold
   * of the vocabulary (an empty list, the wrong export) fails as a broken probe
   * instead of reporting the subject absent.
   */
  it('every LIVE control IS a spec `FieldType`, and every DEAD one is not', () => {
    // Live controls: the four members of the shared family.
    for (const type of EXPANDABLE_FIELD_TYPES) {
      expect(SPEC_FIELD_TYPES, `'${type}' is not a spec FieldType`).toContain(type);
    }
    // Dead controls: a spelling this renderer retired, and pure nonsense.
    // If either turns up "present", the read is broken and the subject reading
    // below means nothing.
    expect(SPEC_FIELD_TYPES).not.toContain('owner');
    expect(SPEC_FIELD_TYPES).not.toContain('zzz_not_a_field_type');
  });

  it('SUBJECT — `reference` is not a declarable field type', () => {
    // The whole licence for dropping it. If the spec ever adds the spelling,
    // this goes red and the "should the shared family gain `reference`?"
    // question reopens — deliberately, rather than the drop remaining correct
    // only by accident.
    expect(SPEC_FIELD_TYPES).not.toContain('reference');
  });

  it('so the dashboard no longer answers for it', () => {
    expect(isLookupType('reference')).toBe(false);
    expect(
      computeLookupExpand({ columns: ALL_COLUMNS }, objectSchema()),
    ).not.toContain('legacy_ref');
    expect(computeLookupExpand({}, objectSchema())).not.toContain('legacy_ref');
  });
});
