/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  getRecordDisplayName,
  deriveTitleField,
  isTitleEligibleField,
  formatTitleTemplate,
} from '../record-title';

describe('getRecordDisplayName — ADR-0079 repro', () => {
  // The exact repro from the bug: an object whose records carry their name in
  // `activity_name`, declaring NO displayNameField and NO titleFormat, plus a
  // non-title date field. Must derive the name via the `*_name` affix rule and
  // NOT render "Untitled".
  const activityObject = {
    fields: {
      activity_name: { type: 'text' },
      start_date: { type: 'date' },
    },
  };

  it('derives `activity_name` via the *_name affix rule (not "Untitled")', () => {
    const record = { id: 'x', activity_name: '夏日城市骑行夜' };
    expect(getRecordDisplayName(activityObject, record)).toBe('夏日城市骑行夜');
  });

  it('falls to `Record #<id>` (never bare "Untitled") when no title field resolves', () => {
    expect(getRecordDisplayName(activityObject, { id: 'x' })).toBe('Record #x');
  });

  it('yields bare "Untitled" only for a truly id-less record', () => {
    expect(getRecordDisplayName(activityObject, {})).toBe('Untitled');
  });
});

describe('getRecordDisplayName — *_name on the RECORD when objectDef is unusable (live gallery repro)', () => {
  // Browser test caught this: ObjectGallery calls getRecordDisplayName with an
  // objectDef whose `.fields` did NOT drive type-aware derivation (async-null,
  // a different fetched shape, …) AND a record without an obvious name-ish key,
  // so the resolver fell straight to bare "Untitled" — the `*_name` value was
  // sitting right there on the record. The record-key affix fallback fixes it.
  it('finds `activity_name` from the record when objectDef has no usable fields', () => {
    expect(getRecordDisplayName({}, { id: '1', activity_name: '夏日城市骑行夜', city: '上海' })).toBe('夏日城市骑行夜');
  });
  it('works with no objectDef at all (null) and even a record with no id', () => {
    expect(getRecordDisplayName(null, { activity_name: '西湖晨跑团' })).toBe('西湖晨跑团');
  });
  it('never lets a `*_id` / system key win the affix scan', () => {
    expect(
      getRecordDisplayName(null, { id: '1', owner_id: 'u1', organization_id: 'o1', activity_name: '外滩摄影漫步' }),
    ).toBe('外滩摄影漫步');
  });
  it('still floors to `Record #<id>` when the record has no name-ish key at all', () => {
    expect(getRecordDisplayName({}, { id: '7', amount: 100, created_at: '2026-01-01' })).toBe('Record #7');
  });
});

describe('getRecordDisplayName — precedence', () => {
  // ADR-0079 Phase 2: an explicitly-declared field outranks the legacy
  // render-only `titleFormat` template. The object declares BOTH a
  // `displayNameField` and a `titleFormat`; the declared field wins.
  it('1. declared displayNameField wins over a legacy titleFormat', () => {
    const obj = {
      titleFormat: '{first} {last}',
      displayNameField: 'name',
      fields: { name: { type: 'text' }, first: { type: 'text' }, last: { type: 'text' } },
    };
    const rec = { id: '1', name: 'Declared', first: 'Ada', last: 'Lovelace' };
    expect(getRecordDisplayName(obj, rec)).toBe('Declared');
  });

  // titleFormat is still honored when no declared field resolves (back-compat).
  it('1b. titleFormat still renders when no nameField/displayNameField is declared', () => {
    const obj = {
      titleFormat: '{first} {last}',
      fields: { first: { type: 'text' }, last: { type: 'text' } },
    };
    const rec = { id: '1', first: 'Ada', last: 'Lovelace' };
    expect(getRecordDisplayName(obj, rec)).toBe('Ada Lovelace');
  });

  it('2. displayNameField wins when no titleFormat', () => {
    const obj = {
      displayNameField: 'activity_name',
      fields: { activity_name: { type: 'text' }, title: { type: 'text' } },
    };
    // `title` would win derivation, but the declared field takes precedence.
    const rec = { id: '1', activity_name: 'Declared', title: 'Derived' };
    expect(getRecordDisplayName(obj, rec)).toBe('Declared');
  });

  it('2b. NAME_FIELD_KEY is accepted as an alias for displayNameField', () => {
    const obj = { NAME_FIELD_KEY: 'activity_name', fields: { activity_name: { type: 'text' } } };
    expect(getRecordDisplayName(obj, { id: '1', activity_name: 'Via alias' })).toBe('Via alias');
  });

  it('2c. skips displayNameField when empty on the record and derives instead', () => {
    const obj = {
      displayNameField: 'code',
      fields: { code: { type: 'text' }, subject: { type: 'text' } },
    };
    const rec = { id: '1', code: '   ', subject: 'Real Subject' };
    expect(getRecordDisplayName(obj, rec)).toBe('Real Subject');
  });

  it('0. explicit titleField option overrides object-level precedence', () => {
    const obj = { titleFormat: '{name}', fields: { name: { type: 'text' }, headline: { type: 'text' } } };
    const rec = { id: '1', name: 'FromFormat', headline: 'FromView' };
    expect(getRecordDisplayName(obj, rec, { titleField: 'headline' })).toBe('FromView');
  });

  it('0b. falls through when explicit titleField is empty on the record', () => {
    const obj = { fields: { name: { type: 'text' } } };
    const rec = { id: '1', name: 'Fallback', headline: '' };
    expect(getRecordDisplayName(obj, rec, { titleField: 'headline' })).toBe('Fallback');
  });

  it('4. custom fallback honored for id-less records', () => {
    expect(getRecordDisplayName({}, {}, { fallback: 'No name' })).toBe('No name');
  });

  it('handles a missing objectDef.fields gracefully (skips derivation)', () => {
    // displayNameField points at a field the record lacks → floor.
    expect(getRecordDisplayName({ displayNameField: 'name' }, { id: '7' })).toBe('Record #7');
    // No fields to derive from, but the record carries a standard `name` → the
    // record-level name probe (step 3b) resolves it (better than `Record #7`).
    expect(getRecordDisplayName(undefined, { id: '7', name: 'X' })).toBe('X');
    // …and with neither, it floors.
    expect(getRecordDisplayName(undefined, { id: '7' })).toBe('Record #7');
  });

  it('uses _id when id is absent', () => {
    expect(getRecordDisplayName({}, { _id: 'abc' })).toBe('Record #abc');
  });

  // Regression: a lightweight object (search candidate) that declares only
  // `titleField`/`label` and carries no `fields` map must still resolve a
  // standard `name`/`first_name` record value, NOT fall to `Record #<id>`.
  it("honors objectDef.titleField when set (object-level title hint)", () => {
    const obj = { name: 'account', label: 'Account', titleField: 'name' };
    expect(getRecordDisplayName(obj, { id: 'a1', name: 'Acme Corp' })).toBe('Acme Corp');
  });

  it('falls back to standard record name keys when fields are absent', () => {
    // No fields → no derivation; the `name`/`full_name`/… record probe catches it.
    expect(getRecordDisplayName({ name: 'account' }, { id: 'a1', name: 'Acme Corp' })).toBe('Acme Corp');
    expect(getRecordDisplayName({}, { id: 'c1', full_name: 'Ada Lovelace' })).toBe('Ada Lovelace');
    expect(getRecordDisplayName({}, { id: 'x', subject: 'Ticket' })).toBe('Ticket');
  });
});

describe('getRecordDisplayName — ADR-0079 Phase 2 (nameField canonical)', () => {
  // (a) nameField is the NEW canonical pointer and must win even when the object
  //     also carries a stale render-only titleFormat.
  it('resolves via nameField even when a stale titleFormat is present (nameField wins)', () => {
    const obj = {
      nameField: 'activity_name',
      titleFormat: '{wrong}',
      fields: { activity_name: { type: 'text' }, wrong: { type: 'text' } },
    };
    const rec = { id: '1', activity_name: '夏日城市骑行夜', wrong: 'STALE TEMPLATE' };
    expect(getRecordDisplayName(obj, rec)).toBe('夏日城市骑行夜');
  });

  it('nameField outranks the displayNameField alias', () => {
    const obj = {
      nameField: 'activity_name',
      displayNameField: 'legacy_name',
      fields: { activity_name: { type: 'text' }, legacy_name: { type: 'text' } },
    };
    const rec = { id: '1', activity_name: 'Canonical', legacy_name: 'Alias' };
    expect(getRecordDisplayName(obj, rec)).toBe('Canonical');
  });

  it('falls through to displayNameField when nameField is empty on the record', () => {
    const obj = {
      nameField: 'activity_name',
      displayNameField: 'legacy_name',
      fields: { activity_name: { type: 'text' }, legacy_name: { type: 'text' } },
    };
    const rec = { id: '1', activity_name: '   ', legacy_name: 'Alias' };
    expect(getRecordDisplayName(obj, rec)).toBe('Alias');
  });

  // (b) An object with ONLY a titleFormat (no nameField/displayNameField) still
  //     resolves via the template — back-compat preserved.
  it('back-compat: titleFormat-only object still resolves via the template', () => {
    const obj = {
      titleFormat: '{first} · {last}',
      fields: { first: { type: 'text' }, last: { type: 'text' } },
    };
    const rec = { id: '1', first: 'Ada', last: 'Lovelace' };
    expect(getRecordDisplayName(obj, rec)).toBe('Ada · Lovelace');
  });
});

describe('deriveTitleField — memoization (per objectDef, not per record)', () => {
  it('returns the same derived field across repeated calls for one objectDef', () => {
    const obj = { fields: { activity_name: { type: 'text' }, start_date: { type: 'date' } } };
    const first = deriveTitleField(obj);
    expect(first).toBe('activity_name');
    // Repeated calls (the per-record hot path) return the identical result.
    for (let i = 0; i < 5; i++) expect(deriveTitleField(obj)).toBe('activity_name');
  });

  it('does NOT re-scan objectDef.fields after the first call (cached)', () => {
    // Lightweight spy: a `fields` map whose property reads are counted. After the
    // first deriveTitleField the cache must serve subsequent calls WITHOUT
    // touching `fields` again (zero further reads).
    let reads = 0;
    const fields = new Proxy(
      { activity_name: { type: 'text' }, start_date: { type: 'date' } } as Record<string, any>,
      {
        get(target, prop, receiver) {
          reads++;
          return Reflect.get(target, prop, receiver);
        },
        ownKeys(target) {
          reads++;
          return Reflect.ownKeys(target);
        },
        getOwnPropertyDescriptor(target, prop) {
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
      },
    );
    const obj = { fields };

    expect(deriveTitleField(obj)).toBe('activity_name');
    const readsAfterFirst = reads;
    expect(readsAfterFirst).toBeGreaterThan(0); // the first scan touched fields

    for (let i = 0; i < 10; i++) deriveTitleField(obj);
    // No additional reads — every later call hit the WeakMap cache.
    expect(reads).toBe(readsAfterFirst);
  });

  it('memoizes an undefined result (object with no title-eligible field)', () => {
    let scans = 0;
    const obj = {
      get fields() {
        scans++;
        return { when: { type: 'date' }, qty: { type: 'number' } };
      },
    };
    expect(deriveTitleField(obj)).toBeUndefined();
    expect(deriveTitleField(obj)).toBeUndefined();
    // `fields` getter invoked exactly once → the cached `undefined` was reused.
    expect(scans).toBe(1);
  });

  it('keeps distinct objectDefs independent (no cross-contamination)', () => {
    const a = { fields: { subject: { type: 'text' } } };
    const b = { fields: { full_name: { type: 'text' } } };
    expect(deriveTitleField(a)).toBe('subject');
    expect(deriveTitleField(b)).toBe('full_name');
    expect(deriveTitleField(a)).toBe('subject');
  });

  it('does not cache primitives/null (computes uncached, no throw)', () => {
    expect(deriveTitleField(null)).toBeUndefined();
    expect(deriveTitleField(undefined)).toBeUndefined();
    expect(deriveTitleField('nope' as any)).toBeUndefined();
  });
});

describe('formatTitleTemplate — handlebars / double-brace', () => {
  it('renders double-brace {{field}} placeholders', () => {
    const obj = { titleFormat: '{{first_name}} {{last_name}}' };
    const rec = { id: 'c1', first_name: 'Ada', last_name: 'Lovelace' };
    expect(getRecordDisplayName(obj, rec)).toBe('Ada Lovelace');
  });

  it('renders {{ field }} with inner whitespace', () => {
    expect(formatTitleTemplate('{{ a }} - {{ b }}', { a: 'X', b: 'Y' })).toBe('X - Y');
  });

  it('still strips orphan separators around empty double-brace fields', () => {
    expect(formatTitleTemplate('{{full_name}} - {{company}}', { company: 'Acme' })).toBe('Acme');
  });
});

describe('deriveTitleField — ranking', () => {
  it('name-ish exact beats affix and declaration order', () => {
    const obj = { fields: { activity_name: { type: 'text' }, name: { type: 'text' }, note: { type: 'text' } } };
    expect(deriveTitleField(obj)).toBe('name');
  });

  it('honors NAME_ISH_EXACT priority order (title before label)', () => {
    const obj = { fields: { label: { type: 'text' }, title: { type: 'text' } } };
    expect(deriveTitleField(obj)).toBe('title');
  });

  it('name-ish affix beats plain declaration order', () => {
    const obj = { fields: { notes: { type: 'text' }, project_title: { type: 'text' } } };
    expect(deriveTitleField(obj)).toBe('project_title');
  });

  it('falls to first title-eligible field by declaration order', () => {
    const obj = { fields: { created: { type: 'datetime' }, amount: { type: 'currency' }, memo: { type: 'text' } } };
    expect(deriveTitleField(obj)).toBe('memo');
  });

  it('returns undefined when no title-eligible field exists', () => {
    const obj = { fields: { when: { type: 'date' }, qty: { type: 'number' }, ok: { type: 'boolean' } } };
    expect(deriveTitleField(obj)).toBeUndefined();
  });

  it('returns undefined when fields are absent', () => {
    expect(deriveTitleField({})).toBeUndefined();
    expect(deriveTitleField(undefined)).toBeUndefined();
  });

  it('supports the array field shape', () => {
    const obj = { fields: [{ name: 'when', type: 'date' }, { name: 'subject', type: 'text' }] };
    expect(deriveTitleField(obj)).toBe('subject');
  });
});

describe('isTitleEligibleField — type gate', () => {
  it.each([
    ['text', true],
    ['email', true],
    ['textarea', true],
    ['date', false],
    ['datetime', false],
    ['time', false],
    ['number', false],
    ['currency', false],
    ['percent', false],
    ['boolean', false],
    ['file', false],
    ['image', false],
    ['attachment', false],
    ['json', false],
    ['geolocation', false],
    ['select', false],
    ['multiselect', false],
    ['picklist', false],
    ['lookup', false],
    ['master_detail', false],
    ['autonumber', false],
    ['auto_number', false],
    ['phone', false],
  ])('type %s -> eligible=%s', (type, eligible) => {
    expect(isTitleEligibleField({ type })).toBe(eligible);
  });

  it('a typeless field is eligible (text-by-default)', () => {
    expect(isTitleEligibleField({})).toBe(true);
  });

  it('formula is eligible only when it returns text', () => {
    expect(isTitleEligibleField({ type: 'formula', data_type: 'text' })).toBe(true);
    expect(isTitleEligibleField({ type: 'formula', returnType: 'string' })).toBe(true);
    expect(isTitleEligibleField({ type: 'formula', data_type: 'number' })).toBe(false);
    expect(isTitleEligibleField({ type: 'formula' })).toBe(false);
  });
});

describe('formatTitleTemplate', () => {
  it('renders a template and strips orphan separators around empty fields', () => {
    expect(formatTitleTemplate('{full_name} - {company}', { company: 'Acme' })).toBe('Acme');
  });

  it('accepts the Expression envelope { source }', () => {
    expect(formatTitleTemplate({ source: '{a}/{b}' }, { a: '1', b: '2' })).toBe('1/2');
  });

  it('walks dotted paths and embedded reference objects', () => {
    expect(formatTitleTemplate('{account.name}', { account: { name: 'Globex' } })).toBe('Globex');
    expect(formatTitleTemplate('{account}', { account: { name: 'Globex' } })).toBe('Globex');
  });

  it('returns empty string when nothing resolves', () => {
    expect(formatTitleTemplate('{missing}', { id: '1' })).toBe('');
    expect(formatTitleTemplate(undefined, { id: '1' })).toBe('');
  });
});
