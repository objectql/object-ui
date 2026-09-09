/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * ⭐ THE RETIRED-DIALECT ARM — objectui#7650.
 *
 * The card measured that the object-schema SERVE path never parses, so
 * `FieldSchema` strictness is evidence about the WRITE door only: a document
 * stored before a key was tightened is served back verbatim, forever. Three
 * retirement cards (#7155, #7166, #7435) had already narrowed the consumer
 * reads to the camelCase spelling. This arm supplies the half that makes that
 * narrowing safe — the legacy spelling is canonicalised ONCE, at ingestion.
 *
 * ## What is pinned, and why each half is here
 *
 * The maintainer route ruling (comment 5605081157) chose the DERIVED fold — the
 * spec's own alias probe (lowercase, strip `_` `-` space) matched exactly
 * against `FieldSchema`'s declared key set — over a hand-written table, and
 * required the negative pins by name. The negatives are the load-bearing half:
 * an implementation that folded everything it could not recognise would pass
 * every positive assertion below.
 *
 *   - `id_field` is NOT folded. It has no declared successor (`FieldSchema` has
 *     no `idField`; the spec's only `idField` sits on `InlineGridColumnSchema`),
 *     and the ruling re-blocked that slice on a `@objectstack/spec` RELEASE
 *     carrying the `FIELD_KEY_GUIDANCE.id_field` row — which is in NO published
 *     version. The point of the derived rule is that this falls out of it for
 *     free rather than being written as a special case.
 *   - `sortible`, a pure TYPO, is NOT folded. The refused alternative was to
 *     call the spec's `lintAuthoredRecordKeys` and fold on its `suggestion`:
 *     that function falls through to a Levenshtein matcher when no `to` row
 *     exists, so it answers "did you mean `sortable`?" for this very input. A
 *     serve path that silently corrects a typo is worse than the defect it fixes.
 *   - `title_format` is NOT folded. It is explicitly out of this card's scope
 *     (it needs an eight-key maintainer ruling), and it too lands there by the
 *     rule rather than by an exclusion.
 *
 * ## The contract-derivation pins
 *
 * `describe('derives the fold from the contract, not from a table')` asserts the
 * rule against `FieldSchema` itself rather than against a copy of its key list:
 * every folded pair must be one the spec REFUSES in the legacy spelling and
 * ACCEPTS in the canonical one, with lit controls in the same read. Without
 * that, this file would be pinning the implementation's opinion of the contract
 * instead of the contract.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FieldSchema } from '@objectstack/spec/data';
import {
  normalizeFieldReferenceKeys,
  normalizeSchemaReferenceKeys,
  resetReferenceKeyWarnings,
} from '../reference-keys';

/** The probe rule, restated here so the test does not import the implementation's copy. */
const probe = (key: string): string => key.toLowerCase().replace(/[_\-\s]/g, '');

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetReferenceKeyWarnings();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

/** A field def with NO relationship target — the shape the reference arm skips. */
const plainField = (extra: Record<string, unknown>) => ({ type: 'text', ...extra });

describe('retired-dialect canonicalization — the three unblocked keys (objectui#7650)', () => {
  it('folds `display_field` onto `displayField`', () => {
    const f: Record<string, unknown> = plainField({ display_field: 'name' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.displayField).toBe('name');
    // The legacy key is LEFT, not removed: dropping it would lose the value for
    // anything still reading it, and dropping was refused on this card.
    expect(f.display_field).toBe('name');
  });

  it('folds `description_field` onto `descriptionField`', () => {
    const f: Record<string, unknown> = plainField({ description_field: 'summary' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.descriptionField).toBe('summary');
  });

  it('folds `lookup_filters` onto `lookupFilters`', () => {
    const filters = [{ field: 'is_active', operator: 'eq', value: true }];
    const f: Record<string, unknown> = plainField({ lookup_filters: filters });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    // The VALUE is carried across by reference, not cloned or reshaped.
    expect(f.lookupFilters).toBe(filters);
  });

  it('folds a twin the card never named — `lookup_columns` — because the rule is general', () => {
    // Not a widening chosen key by key: `lookupColumns` is a declared
    // `FieldSchema` key whose snake twin is in the same retired dialect, so the
    // one derived rule covers it. Pinned so the generality is a measured fact.
    const f: Record<string, unknown> = plainField({ lookup_columns: ['name'] });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.lookupColumns).toEqual(['name']);
  });

  it('runs on a def with NO relationship target', () => {
    // The regression this guards: the reference arm early-returns when there is
    // no `reference` / `reference_to` / `referenceTo`, and the retired dialect
    // lives mostly on fields that have none. Gating the new arm behind that
    // return would have covered almost nothing while passing a lookup-shaped
    // test.
    const f: Record<string, unknown> = plainField({ display_field: 'name' });
    expect(f.reference).toBeUndefined();
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.displayField).toBe('name');
  });

  it('reaches every field of a schema, in both container shapes', () => {
    const asMap = { name: 'account', fields: { owner: plainField({ display_field: 'a' }) } };
    const asArray = { name: 'lead', fields: [plainField({ name: 'owner', display_field: 'b' })] };
    normalizeSchemaReferenceKeys(asMap);
    normalizeSchemaReferenceKeys(asArray);
    expect((asMap.fields.owner as Record<string, unknown>).displayField).toBe('a');
    expect((asArray.fields[0] as Record<string, unknown>).displayField).toBe('b');
  });
});

describe('the NEGATIVE pins the ruling required (objectui#7650)', () => {
  it('does NOT fold `id_field` — no declared successor, and the slice is blocked on a spec release', () => {
    const f: Record<string, unknown> = plainField({ id_field: 'code' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.idField).toBeUndefined();
    expect(f.id_field).toBe('code');
    expect(warn).not.toHaveBeenCalled();
  });

  it('does NOT fold a TYPO — `sortible` never becomes `sortable`', () => {
    const f: Record<string, unknown> = plainField({ sortible: true });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.sortable).toBeUndefined();
    expect(f.sortible).toBe(true);
    expect(warn).not.toHaveBeenCalled();
  });

  it('does NOT fold `title_format` — out of this card, and out of the rule', () => {
    const f: Record<string, unknown> = plainField({ title_format: '{name}' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.titleFormat).toBeUndefined();
    expect(f.title_format).toBe('{name}');
  });

  it('never OVERWRITES a canonical key the producer already set', () => {
    const f: Record<string, unknown> = plainField({
      display_field: 'legacy_name',
      displayField: 'canonical_name',
    });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.displayField).toBe('canonical_name');
    expect(f.display_field).toBe('legacy_name');
    expect(warn).not.toHaveBeenCalled();
  });

  it('is idempotent — a second pass changes nothing and does not warn twice', () => {
    const f: Record<string, unknown> = plainField({ display_field: 'name' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    const afterFirst = JSON.stringify(f);
    const warnsAfterFirst = warn.mock.calls.length;
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(JSON.stringify(f)).toBe(afterFirst);
    expect(warn.mock.calls.length).toBe(warnsAfterFirst);
  });

  it('leaves a declared key alone even when a snake twin of it exists on the def', () => {
    // `displayField` is declared, so it is never itself a fold SOURCE. Without
    // this the pass could re-enter on its own output.
    const f: Record<string, unknown> = plainField({ displayField: 'name' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(Object.keys(f).sort()).toEqual(['displayField', 'type']);
  });
});

describe('the dev-mode warning (objectui#7650)', () => {
  it('names the object, the field, the retired spelling and the canonical one', () => {
    const f: Record<string, unknown> = plainField({ display_field: 'name' });
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]?.[0]);
    expect(message).toContain('account');
    expect(message).toContain('owner');
    expect(message).toContain('display_field');
    expect(message).toContain('displayField');
    expect(message).toContain('objectui#7650');
  });

  it('warns once per (object, field, spelling) and separately for a second object', () => {
    const a: Record<string, unknown> = plainField({ display_field: 'name' });
    normalizeFieldReferenceKeys(a, 'owner', 'account');
    normalizeFieldReferenceKeys(plainField({ display_field: 'name' }), 'owner', 'account');
    expect(warn).toHaveBeenCalledTimes(1);
    normalizeFieldReferenceKeys(plainField({ display_field: 'name' }), 'owner', 'contact');
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('derives the fold from the contract, not from a table (objectui#7650)', () => {
  const declared = Object.keys(FieldSchema.shape as Record<string, unknown>);

  it('reads a non-trivial declared key set — the instrument is not dark', () => {
    expect(declared.length).toBeGreaterThan(50);
    expect(declared).toContain('displayField');
    expect(declared).toContain('descriptionField');
    expect(declared).toContain('lookupFilters');
  });

  it('has NO probe collision among declared keys — the precondition of the guard', () => {
    // The implementation folds nothing onto an ambiguous probe. That branch is
    // unreachable while this holds; when it stops holding, this pin says so
    // before the guard has to.
    const byProbe = new Map<string, string[]>();
    for (const key of declared) {
      const p = probe(key);
      byProbe.set(p, [...(byProbe.get(p) ?? []), key]);
    }
    const collisions = [...byProbe.entries()].filter(([, keys]) => keys.length > 1);
    expect(collisions).toEqual([]);
  });

  it.each([
    ['display_field', 'displayField', 'name'],
    ['description_field', 'descriptionField', 'summary'],
    ['lookup_filters', 'lookupFilters', []],
    ['lookup_columns', 'lookupColumns', []],
  ])('the spec REFUSES %s and ACCEPTS %s', (legacy, canonical, value) => {
    const base = { type: 'lookup', reference: 'user' };
    const refused = FieldSchema.safeParse({ ...base, [legacy]: value });
    const accepted = FieldSchema.safeParse({ ...base, [canonical]: value });
    expect(refused.success).toBe(false);
    expect(refused.error?.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
    expect(accepted.success).toBe(true);
  });

  it('LIT CONTROLS for the pair above — a bare def parses, a nonsense key does not', () => {
    // Without these, the "REFUSES" half above is satisfied by a schema that
    // refuses everything and the "ACCEPTS" half by one that accepts everything.
    expect(FieldSchema.safeParse({ type: 'lookup', reference: 'user' }).success).toBe(true);
    expect(
      FieldSchema.safeParse({ type: 'lookup', reference: 'user', zzz_not_a_real_key: 1 }).success,
    ).toBe(false);
  });

  it.each(['id_field', 'title_format', 'sortible'])(
    'the LEAVE arm is contract-derived too — %s probes onto no declared key',
    (key) => {
      expect(declared.map(probe)).not.toContain(probe(key));
    },
  );

  it('the reference pair stays OUT of the derived arm — it has its own', () => {
    // `referenceTo` is not a declared key, so `reference_to` probes onto
    // nothing and the derived arm ignores it. The reference stamp below is the
    // separate, older mechanism, and this pin keeps the two from double-handling.
    expect(declared.map(probe)).not.toContain(probe('reference_to'));
    const f: Record<string, unknown> = { type: 'lookup', reference_to: 'user' };
    normalizeFieldReferenceKeys(f, 'owner', 'account');
    expect(f.reference).toBe('user');
    expect(f.reference_to).toBe('user');
  });
});
