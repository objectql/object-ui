/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#6575 — the PURE half of the `bind`-is-ignored diagnostic: what it
 * says, and the silence it has to keep.
 *
 * The rendered half (the warning actually reaching the console through the
 * real `SchemaRenderer`, and NOT reaching it on a node without `bind`) is
 * pinned in `src/__tests__/skill-guide-data-table-binding.test.tsx`, next to
 * the behaviour assertions it has to stay consistent with. This file judges
 * the message text, which is the part an author reads.
 *
 * Every zero below is paired with a positive control in the same query shape:
 * "no message for X" is only a reading once "a message for Y" passes through
 * the same call.
 */

import { describe, it, expect } from 'vitest';
import {
  describeIgnoredBind,
  hasAuthoredBind,
  DATA_TABLE_BIND_DIAGNOSTIC_PREFIX,
} from '../dataTableBindDiagnostic';

const ADDRESS = { blockType: 'data-table', id: 'customers-table', caption: 'Customers' };
const ROWS = [{ name: 'Ada Lovelace' }, { name: 'Grace Hopper' }];

describe('hasAuthoredBind — absence is `undefined`, and nothing else (#6575)', () => {
  it('is false only for an omitted key', () => {
    expect(hasAuthoredBind(undefined)).toBe(false);
    // Positive control in the same shape: a written key is written.
    expect(hasAuthoredBind('customers')).toBe(true);
  });

  it('counts the falsy values an author can actually type', () => {
    // `null` and `''` are things someone WROTE. They bought nothing either, and
    // a diagnostic that skipped them would be silent on the exact typo — an
    // emptied-out binding — that looks most like a working one.
    expect(hasAuthoredBind(null)).toBe(true);
    expect(hasAuthoredBind('')).toBe(true);
    expect(hasAuthoredBind(0)).toBe(true);
  });
});

describe('describeIgnoredBind — silence, and the control that earns it (#6575)', () => {
  it('says nothing when no `bind` was authored', () => {
    expect(describeIgnoredBind(undefined, ROWS, ADDRESS)).toBeNull();
    // The counter-probe: the SAME call with a `bind` does produce a message,
    // so the null above is a verdict rather than a broken code path.
    expect(describeIgnoredBind('customers', ROWS, ADDRESS)).not.toBeNull();
  });

  it('stays silent on a table with rows and no `bind` — the common case', () => {
    expect(describeIgnoredBind(undefined, [], ADDRESS)).toBeNull();
    expect(describeIgnoredBind(undefined, undefined, ADDRESS)).toBeNull();
  });
});

describe('describeIgnoredBind — what the author is told (#6575)', () => {
  it('names the address, the path, and the key that IS read', () => {
    const message = describeIgnoredBind('customers', [], ADDRESS)!;
    expect(message).toContain(DATA_TABLE_BIND_DIAGNOSTIC_PREFIX);
    // The address: which node on the page, not merely "a data-table".
    expect(message).toContain("data-table (id: 'customers-table', caption: 'Customers')");
    // The path the author spelled, quoted back at them.
    expect(message).toContain("`bind: 'customers'` is ignored");
    // The sentence the maintainer ruling names, and the corpus already teaches
    // in `skills/objectui/rules/protocol.md`.
    expect(message).toContain(
      'data-table does not read `bind`; it reads its rows from the inline `data` array on the node',
    );
    // The way out. A message that only reported the fault would leave the
    // author exactly where the silence did.
    expect(message).toContain('Put the rows in `data`');
    expect(message).toContain('`list`, `tree-view`, or an `object-*` widget');
    expect(message).toContain('objectui#6575');
  });

  it('claims the empty body ONLY when the body is empty', () => {
    const empty = describeIgnoredBind('customers', [], ADDRESS)!;
    expect(empty).toContain('renders its header over an empty body');

    // Both keys authored: the table is NOT empty, so the consequence sentence
    // above would be a message asserting something it did not check.
    const withRows = describeIgnoredBind('customers', ROWS, ADDRESS)!;
    expect(withRows).not.toContain('empty body');
    expect(withRows).toContain('The 2 rows on screen come from `data`');
    expect(withRows).toContain('the `bind` contributes nothing');
  });

  it('counts one row in the singular', () => {
    expect(describeIgnoredBind('customers', [ROWS[0]], ADDRESS)!).toContain(
      'The 1 row on screen comes from `data`',
    );
  });

  it('treats a non-array `data` as no rows — the renderer already does', () => {
    // `DataTableRenderer` resolves a provider-config object to `EMPTY_ROWS`
    // before rendering, so the body really is empty here.
    const message = describeIgnoredBind('customers', { provider: 'object' }, ADDRESS)!;
    expect(message).toContain('renders its header over an empty body');
  });

  it('quotes a non-string `bind` without pretending it was a path', () => {
    expect(describeIgnoredBind(null, [], ADDRESS)!).toContain('`bind: null` is ignored');
    expect(describeIgnoredBind(42, [], ADDRESS)!).toContain('`bind: 42` is ignored');
  });

  it('falls back to the block name when the node carries no id or caption', () => {
    const message = describeIgnoredBind('customers', [], {})!;
    expect(message).toContain(`${DATA_TABLE_BIND_DIAGNOSTIC_PREFIX} data-table —`);
    // Not an empty parenthetical where the address should be.
    expect(message).not.toContain('()');
  });
});
