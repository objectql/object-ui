/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * `convertSortToQueryParams` — the shared sort→`$orderby` sink introduced with
 * objectstack#7137, when `object-timeline` and `record:line_items` gained sort
 * read sites and would otherwise have made a fifth and sixth private copy of the
 * conversion `ObjectGantt` / `ObjectMap` / `ObjectCalendar` each inline.
 *
 * Two of the cases below pin the two places this function is deliberately MORE
 * faithful to the declared contract than those copies: `SortConfig.order` is
 * optional (an entry without it means ascending, not "drop this key"), and
 * nothing usable yields `undefined` rather than a truthy-but-empty `{}`.
 *
 * The rest pin objectui#8221 (director ruling, decision batch #77, option B):
 * the legacy string clause is RETIRED, and — this is the load-bearing half —
 * it is refused OUT LOUD. Types are erased, so the narrowed signature stops a
 * string only at compile time; authored JSON and stored metadata rows still
 * reach this function carrying `"name desc"`. A silent `undefined` there is an
 * authored row order that quietly stops applying, which is precisely the
 * failure this repository keeps measuring. Every refusal below is therefore
 * paired with a well-formed control that still lowers: a sink that refused
 * everything would satisfy the refusal assertions on its own.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { convertSortToQueryParams, resetRetiredSortSpellingReports } from '../sort-query';

/** The retired spelling, reached the only way it still can be: at runtime. */
const asRuntimeValue = (value: unknown) => value as unknown as Parameters<typeof convertSortToQueryParams>[0];

describe('convertSortToQueryParams', () => {
  it('lowers a SortConfig[] preserving key order', () => {
    expect(
      convertSortToQueryParams([
        { field: 'stage', order: 'asc' },
        { field: 'amount', order: 'desc' },
      ]),
    ).toEqual({ stage: 'asc', amount: 'desc' });
    expect(
      Object.keys(
        convertSortToQueryParams([
          { field: 'stage', order: 'asc' },
          { field: 'amount', order: 'desc' },
        ])!,
      ),
    ).toEqual(['stage', 'amount']);
  });

  it('treats an entry with no `order` as ascending instead of dropping it', () => {
    // `$orderby`'s own declared shape is `Array<{ field: string; order?: … }>`,
    // so an omitted direction means ascending. The three private copies this
    // function replaces require both keys and drop such an entry, losing an
    // authored sort key.
    expect(convertSortToQueryParams([{ field: 'line_no' }])).toEqual({ line_no: 'asc' });
    expect(
      convertSortToQueryParams([{ field: 'line_no' }, { field: 'amount', order: 'desc' }]),
    ).toEqual({ line_no: 'asc', amount: 'desc' });
  });

  it('returns undefined — never an empty object — when nothing is orderable', () => {
    expect(convertSortToQueryParams(undefined)).toBeUndefined();
    expect(convertSortToQueryParams(null)).toBeUndefined();
    expect(convertSortToQueryParams([])).toBeUndefined();
    // Entries with no usable field name contribute nothing, and an all-unusable
    // array must not produce a truthy `{}` that a caller would send as $orderby.
    expect(convertSortToQueryParams([{ order: 'desc' }])).toBeUndefined();
    expect(convertSortToQueryParams([{ field: '' }])).toBeUndefined();
    // Shapes the schema types do not declare are refused, not guessed at.
    expect(convertSortToQueryParams(asRuntimeValue(42))).toBeUndefined();
    expect(convertSortToQueryParams(asRuntimeValue({ name: 'desc' }))).toBeUndefined();
  });
});

describe('convertSortToQueryParams — the retired string clause (objectui#8221)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // The reporter dedupes per spelling in module state, so without this the
    // second test to assert a diagnostic would observe silence and pass for
    // entirely the wrong reason.
    resetRetiredSortSpellingReports();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('REFUSES every string spelling the retired arm used to lower', () => {
    // The four readings the retired arm implemented, one per line. Each now
    // yields no ordering at all rather than the map it used to build.
    for (const spelling of ['name desc', 'name asc', 'name', 'name DESC']) {
      resetRetiredSortSpellingReports();
      expect(convertSortToQueryParams(asRuntimeValue(spelling))).toBeUndefined();
    }

    // CONTROL — the array arm still lowers on the same function, so the
    // assertions above are a refusal of the string and not a dead sink.
    expect(convertSortToQueryParams([{ field: 'name', order: 'desc' }])).toEqual({ name: 'desc' });
  });

  it('names the array form in the diagnostic — the refusal is legible, not silent', () => {
    expect(convertSortToQueryParams(asRuntimeValue('name desc'))).toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const message = String(errorSpy.mock.calls[0][0]);
    // The fix, not just the complaint: the message has to carry the spelling
    // the author must switch to, or it sends them looking for one.
    expect(message).toContain("[{ field: 'name', order: 'desc' }]");
    expect(message).toContain('retired');
    // It quotes what actually arrived, so the author can find it in their JSON.
    expect(message).toContain('"name desc"');
    // And it says the consequence out loud, because "refused" without "so your
    // rows are unordered" reads as a style note.
    expect(message).toContain('$orderby');
  });

  it('reports once per spelling — a render loop must not bury its own message', () => {
    convertSortToQueryParams(asRuntimeValue('name desc'));
    convertSortToQueryParams(asRuntimeValue('name desc'));
    convertSortToQueryParams(asRuntimeValue('name desc'));
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // CONTROL — a DIFFERENT retired spelling is a different authoring mistake
    // and still gets its own line, so the dedupe is per spelling and not a
    // one-message-ever latch.
    convertSortToQueryParams(asRuntimeValue('amount asc'));
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('stays silent for values that were never the retired spelling', () => {
    // An empty / absent `sort` is "the author asked for nothing", not "the
    // author used the retired clause" — reporting it would train readers to
    // ignore the message.
    expect(convertSortToQueryParams(asRuntimeValue(''))).toBeUndefined();
    expect(convertSortToQueryParams(undefined)).toBeUndefined();
    expect(convertSortToQueryParams(null)).toBeUndefined();
    // Nor for shapes that were never declared in either arm.
    expect(convertSortToQueryParams(asRuntimeValue(42))).toBeUndefined();
    expect(convertSortToQueryParams(asRuntimeValue({ name: 'desc' }))).toBeUndefined();
    // Nor for the arm that still works.
    expect(convertSortToQueryParams([{ field: 'name' }])).toEqual({ name: 'asc' });
    expect(errorSpy).not.toHaveBeenCalled();

    // CONTROL — the spy IS wired to this function: one retired spelling on the
    // same spy makes it fire, so the silence above is a reading and not a
    // disconnected mock.
    expect(convertSortToQueryParams(asRuntimeValue('   '))).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
