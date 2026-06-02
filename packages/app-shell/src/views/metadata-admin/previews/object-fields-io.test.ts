// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

import { describe, it, expect } from 'vitest';
import {
  readFields,
  writeFields,
  readGroups,
  genGroupKey,
  addGroup,
  renameGroup,
  removeGroup,
  moveGroup,
  clearFieldGroup,
  groupEntries,
  diffFields,
  type FieldsView,
} from './object-fields-io';

/* ─────────────── readGroups ─────────────── */

describe('readGroups', () => {
  it('returns [] for non-array / nullish input', () => {
    expect(readGroups(undefined)).toEqual([]);
    expect(readGroups(null)).toEqual([]);
    expect(readGroups({})).toEqual([]);
  });

  it('normalizes entries and drops keyless rows', () => {
    expect(
      readGroups([
        { key: 'a', label: 'Alpha' },
        { key: 'b' }, // no label → label ''
        { label: 'orphan' }, // no key → dropped
        'garbage',
      ]),
    ).toEqual([
      { key: 'a', label: 'Alpha' },
      { key: 'b', label: '' },
    ]);
  });
});

/* ─────────────── genGroupKey ─────────────── */

describe('genGroupKey', () => {
  it('derives a snake_case key from the label', () => {
    expect(genGroupKey('Contact Info', [])).toBe('contact_info');
  });

  it('falls back to "group" for empty / symbol-only labels', () => {
    expect(genGroupKey('', [])).toBe('group');
    expect(genGroupKey('!!!', [])).toBe('group');
  });

  it('suffixes to avoid collisions', () => {
    expect(genGroupKey('Details', ['details'])).toBe('details_2');
    expect(genGroupKey('Details', ['details', 'details_2'])).toBe('details_3');
  });
});

/* ─────────────── addGroup ─────────────── */

describe('addGroup', () => {
  it('appends a group with a unique key derived from the label', () => {
    const next = addGroup([{ key: 'details', label: 'Details' }], 'Details');
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual({ key: 'details_2', label: 'Details' });
  });

  it('defaults blank labels to "New section"', () => {
    const next = addGroup([], '   ');
    expect(next[0].label).toBe('New section');
    expect(next[0].key).toBe('new_section');
  });

  it('does not mutate the input array', () => {
    const input = [{ key: 'a', label: 'A' }];
    addGroup(input, 'B');
    expect(input).toHaveLength(1);
  });
});

/* ─────────────── renameGroup ─────────────── */

describe('renameGroup', () => {
  const groups = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
  ];

  it('renames the matching group, leaving the key stable', () => {
    expect(renameGroup(groups, 'a', 'Alpha')).toEqual([
      { key: 'a', label: 'Alpha' },
      { key: 'b', label: 'B' },
    ]);
  });

  it('ignores blank labels (no-op)', () => {
    expect(renameGroup(groups, 'a', '   ')).toBe(groups);
  });
});

/* ─────────────── removeGroup / moveGroup ─────────────── */

describe('removeGroup', () => {
  it('drops the matching declaration', () => {
    expect(removeGroup([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], 'a')).toEqual([
      { key: 'b', label: 'B' },
    ]);
  });
});

describe('moveGroup', () => {
  const groups = [
    { key: 'a', label: 'A' },
    { key: 'b', label: 'B' },
    { key: 'c', label: 'C' },
  ];

  it('moves up / down', () => {
    expect(moveGroup(groups, 'b', -1).map((g) => g.key)).toEqual(['b', 'a', 'c']);
    expect(moveGroup(groups, 'b', 1).map((g) => g.key)).toEqual(['a', 'c', 'b']);
  });

  it('clamps at the bounds (no-op)', () => {
    expect(moveGroup(groups, 'a', -1)).toEqual(groups);
    expect(moveGroup(groups, 'c', 1)).toEqual(groups);
  });
});

/* ─────────────── clearFieldGroup ─────────────── */

describe('clearFieldGroup', () => {
  it('strips `group` only from fields in the removed group', () => {
    const view: FieldsView = {
      shape: 'record',
      entries: [
        { name: 'a', def: { type: 'text', group: 'g1' } },
        { name: 'b', def: { type: 'text', group: 'g2' } },
        { name: 'c', def: { type: 'text' } },
      ],
    };
    const next = clearFieldGroup(view, 'g1');
    expect(next.entries[0].def.group).toBeUndefined();
    expect(next.entries[1].def.group).toBe('g2');
    expect(next.entries[2].def.group).toBeUndefined();
    // Original untouched (immutable).
    expect(view.entries[0].def.group).toBe('g1');
  });
});

/* ─────────────── groupEntries ─────────────── */

describe('groupEntries', () => {
  const view = readFields({
    name: { type: 'text', group: 'profile' },
    email: { type: 'email', group: 'profile' },
    note: { type: 'textarea' }, // ungrouped
  });
  const declared = [
    { key: 'profile', label: 'Profile' },
    { key: 'empty', label: 'Empty' },
  ];

  it('buckets fields in declared order, ungrouped last', () => {
    const groups = groupEntries(view, declared);
    expect(groups.map((g) => g.key)).toEqual(['profile', null]);
    expect(groups[0].entries.map((e) => e.name)).toEqual(['name', 'email']);
    expect(groups[1].label).toBe('Ungrouped');
  });

  it('drops empty declared groups by default', () => {
    expect(groupEntries(view, declared).some((g) => g.key === 'empty')).toBe(false);
  });

  it('keeps empty declared groups when includeEmptyDeclared is set', () => {
    const groups = groupEntries(view, declared, { includeEmptyDeclared: true });
    expect(groups.map((g) => g.key)).toEqual(['profile', 'empty', null]);
    expect(groups.find((g) => g.key === 'empty')!.entries).toEqual([]);
  });

  it('routes fields whose group is not declared into Ungrouped', () => {
    const v = readFields({ x: { type: 'text', group: 'ghost' } });
    const groups = groupEntries(v, declared);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBeNull();
    expect(groups[0].entries[0].name).toBe('x');
  });
});

/* ─────────────── round-trip safety ─────────────── */

describe('group ops preserve the fields round-trip shape', () => {
  it('clearFieldGroup → writeFields keeps array shape & unknown keys', () => {
    const view = readFields([
      { name: 'a', type: 'text', group: 'g1', customExtra: 1 },
    ]);
    const out = writeFields(clearFieldGroup(view, 'g1')) as Array<Record<string, unknown>>;
    expect(Array.isArray(out)).toBe(true);
    expect(out[0].name).toBe('a');
    expect(out[0].customExtra).toBe(1);
    expect(out[0].group).toBeUndefined();
  });
});

/* ─────────────── diffFields (review mode) ─────────────── */

describe('diffFields', () => {
  const baseline = {
    name: { type: 'text', label: 'Name' },
    email: { type: 'email', label: 'Email' },
    legacy: { type: 'text', label: 'Legacy' },
  };
  const current = {
    name: { type: 'text', label: 'Name' }, // unchanged
    email: { type: 'email', label: 'Email Address', required: true }, // changed
    phone: { type: 'phone', label: 'Phone' }, // added
    // legacy removed
  };

  it('classifies added / changed / removed / unchanged', () => {
    const d = diffFields(baseline, current);
    expect(d.byName.name.status).toBe('unchanged');
    expect(d.byName.email.status).toBe('changed');
    expect(d.byName.phone.status).toBe('added');
    expect(d.counts).toEqual({ added: 1, changed: 1, removed: 1 });
  });

  it('reports the changed def keys (sorted)', () => {
    const d = diffFields(baseline, current);
    expect(d.byName.email.changedKeys).toEqual(['label', 'required']);
  });

  it('surfaces removed fields as entries for ghost rendering', () => {
    const d = diffFields(baseline, current);
    expect(d.removed.map((e) => e.name)).toEqual(['legacy']);
    expect(d.removed[0].def).toMatchObject({ type: 'text', label: 'Legacy' });
  });

  it('treats a missing/empty baseline as everything-added', () => {
    const d = diffFields(undefined, { a: { type: 'text' }, b: { type: 'text' } });
    expect(d.counts).toEqual({ added: 2, changed: 0, removed: 0 });
  });

  it('is shape-agnostic (array baseline vs record current)', () => {
    const d = diffFields(
      [{ name: 'a', type: 'text' }, { name: 'b', type: 'text' }],
      { a: { type: 'text' } }, // b removed
    );
    expect(d.byName.a.status).toBe('unchanged');
    expect(d.counts.removed).toBe(1);
    expect(d.removed[0].name).toBe('b');
  });

  it('order-insensitive equality does not flag re-ordered identical defs', () => {
    const d = diffFields(
      { a: { type: 'text', label: 'A' } },
      { a: { label: 'A', type: 'text' } },
    );
    expect(d.byName.a.status).toBe('unchanged');
  });
});
