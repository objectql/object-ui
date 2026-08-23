/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#5330 — the row-predicate spelling CANON (`record.*`) and its Phase-1
 * deprecation warning.
 *
 * These pins are deliberately split in two, because the card's two halves fail
 * in opposite directions:
 *
 *  - the CANON pins assert the binding is UNCHANGED. The ruling defers every
 *    removal behind a stored-metadata survey, so a test that stopped resolving
 *    the shorthand would be the regression, not the feature.
 *  - the WARNING pins assert the tolerance is no longer silent — the ADR-0078
 *    reason a tolerance nothing reports can never be retired.
 *
 * The `record-alert` renderer's own three-spelling pins landed separately with
 * PR #5688 (`plugin-detail/.../record-alert.rowBinding.test.tsx`) and are NOT
 * duplicated here; this file pins the shared evaluator tier those renderers sit
 * on, plus the detector itself.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectNonCanonicalRowSpelling,
  resetRowPredicateCanonWarnings,
  ROW_PREDICATE_CANONICAL_ROOT,
  evalRowPredicate,
} from '../index.js';

const row = { status: 'in_review', amount: 10 };

beforeEach(() => resetRowPredicateCanonWarnings());

describe('[#5330] the canon is `record.*`', () => {
  it('names `record` as the one canonical root', () => {
    expect(ROW_PREDICATE_CANONICAL_ROOT).toBe('record');
  });

  it('reports nothing for the canonical spelling', () => {
    expect(detectNonCanonicalRowSpelling("record.status == 'in_review'", row, true)).toBeNull();
  });
});

describe('[#5330] non-canonical spellings are DETECTED', () => {
  it('reports the bare shorthand, and names the canonical rewrite', () => {
    expect(detectNonCanonicalRowSpelling("status == 'in_review'", row, true)).toEqual({
      kind: 'bare-shorthand',
      identifier: 'status',
      canonical: 'record.status',
    });
  });

  it('reports a `data.`-rooted predicate on a record surface', () => {
    expect(detectNonCanonicalRowSpelling("data.status == 'in_review'", row, true)).toEqual({
      kind: 'metadata-layer-root',
      identifier: 'data',
      canonical: 'record',
    });
  });
});

/**
 * Every case here is a spelling the detector must NOT report. They are the
 * whole reason it consults the row and the caller's binding rather than
 * pattern-matching the source: a false deprecation warning sends an author to
 * rewrite a predicate that was correct.
 */
describe('[#5330] the detector stands down rather than guessing', () => {
  it('leaves `data.*` alone when `data` is NOT this row (rowless / metadata-editing layer)', () => {
    // ADR-0089 D3: `data` is the CANONICAL root of a metadata-editing form.
    // Reporting it there would contradict that layer's own contract.
    expect(detectNonCanonicalRowSpelling("data.status == 'in_review'", row, false)).toBeNull();
  });

  it('leaves a host-scope root alone', () => {
    expect(detectNonCanonicalRowSpelling('features.beta == true', row, true)).toBeNull();
  });

  it('leaves an undeclared identifier alone when it is not a field of THIS row', () => {
    // A deployment global this module cannot see is not the #4075 shorthand.
    expect(detectNonCanonicalRowSpelling('unknownGlobal == 1', row, true)).toBeNull();
  });

  it('leaves an unparseable source alone — syntax is another gate’s verdict', () => {
    expect(detectNonCanonicalRowSpelling("record.status === 'x'", row, true)).toBeNull();
  });
});

describe('[#5330] `evalRowPredicate` — the binding is UNCHANGED (no removal before the survey)', () => {
  it('still resolves all three spellings against the row', () => {
    expect(evalRowPredicate("record.status == 'in_review'", row)).toBe(true);
    expect(evalRowPredicate("status == 'in_review'", row)).toBe(true);
    expect(evalRowPredicate("data.status == 'in_review'", row)).toBe(true);
  });

  it('still tells the three spellings apart on a NON-matching row (not vacuously true)', () => {
    const other = { status: 'draft', amount: 1 };
    expect(evalRowPredicate("record.status == 'in_review'", other)).toBe(false);
    expect(evalRowPredicate("status == 'in_review'", other)).toBe(false);
    expect(evalRowPredicate("data.status == 'in_review'", other)).toBe(false);
  });
});

describe('[#5330] `evalRowPredicate` — the tolerance is no longer silent', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  const deprecationWarnings = (): string[] =>
    warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('DEPRECATED spelling'));

  it('warns on the bare shorthand and prescribes `record.status`', () => {
    evalRowPredicate("status == 'in_review'", row, { label: 'row action "approve"' });
    const msgs = deprecationWarnings();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('record.status');
    expect(msgs[0]).toContain('objectui#5330');
    expect(msgs[0]).toContain('row action "approve"');
  });

  it('warns on `data.*` and says the server binds no `data` at all', () => {
    evalRowPredicate("data.status == 'in_review'", row);
    const msgs = deprecationWarnings();
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('metadata-editing-form root');
  });

  it('stays silent for the canonical spelling', () => {
    evalRowPredicate("record.status == 'in_review'", row);
    expect(deprecationWarnings()).toHaveLength(0);
  });

  it('warns ONCE per (label, predicate) — these run on every row of every frame', () => {
    for (let i = 0; i < 5; i++) evalRowPredicate("status == 'in_review'", row, { label: 'grid' });
    expect(deprecationWarnings()).toHaveLength(1);
  });

  it('does NOT report a legacy `${…}`-dialect predicate, where `data.*` is the normal spelling', () => {
    evalRowPredicate('${data.status === "in_review"}', row);
    expect(deprecationWarnings()).toHaveLength(0);
  });
});
