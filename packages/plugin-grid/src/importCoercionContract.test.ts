/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Gates on the Import Wizard's mirror of the server's import-coercion
 * contract (`import-coerce.ts` in the framework) — objectui#3017.
 *
 * `REFERENCE_IMPORT_TYPES` is derived from the same spec constant the server
 * derives from, so the two ends share one source. The boolean token table has
 * no spec export yet (objectstack#4173), so it cannot be derived — the pinned
 * inventory below is the tripwire that makes edits deliberate instead of
 * silent. When the spec starts publishing the table, replace the local sets
 * with the import and delete the inventory.
 */

import { describe, it, expect } from 'vitest';
import { REFERENCE_VALUE_TYPES } from '@objectstack/spec/data';
import {
  BOOLEAN_FALSE_IMPORT_TOKENS,
  BOOLEAN_IMPORT_TOKENS,
  BOOLEAN_TRUE_IMPORT_TOKENS,
  REFERENCE_IMPORT_TYPES,
} from './importCoercionContract';

describe('BOOLEAN_IMPORT_TOKENS (server BOOL_TRUE/BOOL_FALSE mirror)', () => {
  it('pins the token inventory — edits must be checked against the server table', () => {
    // Deliberate second statement: if this fails you edited the wizard's
    // boolean vocabulary. Verify the server's BOOL_TRUE/BOOL_FALSE in
    // import-coerce.ts accepts the same tokens before re-pinning, or the
    // preview will flag cells the server takes (or wave through cells it
    // rejects as `invalid_boolean`).
    expect([...BOOLEAN_TRUE_IMPORT_TOKENS].sort()).toEqual(
      ['true', 't', 'yes', 'y', '1', 'on', '是', '对', '✓', '√'].sort(),
    );
    expect([...BOOLEAN_FALSE_IMPORT_TOKENS].sort()).toEqual(
      ['false', 'f', 'no', 'n', '0', 'off', '否', '错', '✗', '×'].sort(),
    );
  });

  it('true and false tokens are disjoint — one token, one verdict', () => {
    for (const token of BOOLEAN_TRUE_IMPORT_TOKENS) {
      expect(BOOLEAN_FALSE_IMPORT_TOKENS.has(token), `'${token}' is both truthy and falsy`).toBe(false);
    }
  });

  it('every token survives the lookup normalization (trim + lowercase)', () => {
    // validateValue checks `value.trim().toLowerCase()` against the set — a
    // token stored with case or whitespace could never match anything.
    for (const token of BOOLEAN_IMPORT_TOKENS) {
      expect(token, `'${token}' is not trim/lowercase-normalized`).toBe(token.trim().toLowerCase());
      expect(token.length).toBeGreaterThan(0);
    }
  });

  it('the combined set is exactly the union of the two verdict sets', () => {
    expect(BOOLEAN_IMPORT_TOKENS.size).toBe(
      BOOLEAN_TRUE_IMPORT_TOKENS.size + BOOLEAN_FALSE_IMPORT_TOKENS.size,
    );
    for (const token of [...BOOLEAN_TRUE_IMPORT_TOKENS, ...BOOLEAN_FALSE_IMPORT_TOKENS]) {
      expect(BOOLEAN_IMPORT_TOKENS.has(token)).toBe(true);
    }
  });
});

describe('REFERENCE_IMPORT_TYPES (derived from spec REFERENCE_VALUE_TYPES)', () => {
  it('is spec plus the generic reference alias, nothing else', () => {
    for (const type of REFERENCE_VALUE_TYPES) {
      expect(REFERENCE_IMPORT_TYPES.has(type)).toBe(true);
    }
    expect(REFERENCE_IMPORT_TYPES.has('reference')).toBe(true);
    // Also implies 'reference' ∉ REFERENCE_VALUE_TYPES today — if the spec
    // starts including it, this fails so the local alias can be retired.
    expect(REFERENCE_IMPORT_TYPES.size).toBe(REFERENCE_VALUE_TYPES.size + 1);
  });

  it('is not vacuous — the types the legacy-fallback refusal exists for are still covered', () => {
    // The per-row create fallback stores raw cell text verbatim; if a member
    // vanished from the spec set, the wizard would silently stop refusing to
    // fall back for that type and corrupt relation fields. Fail loudly and
    // make the vocabulary change a deliberate review.
    for (const type of ['lookup', 'master_detail', 'user', 'tree', 'reference']) {
      expect(REFERENCE_IMPORT_TYPES.has(type), `'${type}' no longer covered — spec vocabulary moved?`).toBe(true);
    }
  });
});
