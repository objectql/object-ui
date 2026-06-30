/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, it, expect } from 'vitest';
import {
  FORM_FIELD_TYPES,
  INLINE_EXCLUDED_FIELD_TYPES,
  hasFieldEditWidget,
} from './index';

/**
 * Drift-guard: the inline cell editor reuses the form's field widgets, but the
 * two lists were hand-maintained separately and drifted — `lookup` (and other
 * relational types) had a perfectly good form widget yet fell back to a plain
 * text box inline, because nobody wired it up. This pins the contract: every
 * type the FORM can render must have an explicit inline decision — an editor or
 * a documented exclusion — so a new form widget can never again silently become
 * an editable text box (or a missing one) in the grid.
 */
describe('inline editor ↔ form widget parity', () => {
  it('every form field type either has an inline editor or is explicitly excluded', () => {
    const undecided = FORM_FIELD_TYPES.filter(
      (t) => !hasFieldEditWidget(t) && !INLINE_EXCLUDED_FIELD_TYPES.has(t),
    );
    // If this fails: a form widget type has no inline decision. Either add it to
    // EDIT_WIDGETS (inline-editable) or to INLINE_EXCLUDED_FIELD_TYPES (with a
    // reason) in FieldEditWidget.tsx.
    expect(undecided).toEqual([]);
  });

  it('the exclusion set lists only real form types (no stale entries)', () => {
    const known = new Set(FORM_FIELD_TYPES);
    const stale = [...INLINE_EXCLUDED_FIELD_TYPES].filter((t) => !known.has(t));
    expect(stale).toEqual([]);
  });

  it('relational fields use the standard picker inline (regression: lookup was a text box)', () => {
    for (const t of ['lookup', 'master_detail', 'user', 'owner']) {
      expect(hasFieldEditWidget(t)).toBe(true);
    }
  });

  it('computed / binary form types are NOT inline-editable (excluded)', () => {
    for (const t of ['formula', 'summary', 'auto_number', 'file', 'image']) {
      expect(hasFieldEditWidget(t)).toBe(false);
      expect(INLINE_EXCLUDED_FIELD_TYPES.has(t)).toBe(true);
    }
  });

  it('structured-value types edit inline with their form widget (color/address/location/code/…)', () => {
    for (const t of ['color', 'address', 'location', 'geolocation', 'code', 'qrcode']) {
      expect(hasFieldEditWidget(t)).toBe(true);
      expect(INLINE_EXCLUDED_FIELD_TYPES.has(t)).toBe(false);
    }
  });
});
