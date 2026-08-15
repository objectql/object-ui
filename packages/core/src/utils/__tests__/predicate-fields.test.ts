/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `collectPredicateFieldRefs` / `listViewPredicates` — the fields a view's
 * PREDICATES read, which its column-derived `$select` never asked for
 * (objectui#3501).
 */

import { describe, it, expect } from 'vitest';
import { collectPredicateFieldRefs, listViewPredicates, isProjectableField } from '../predicate-fields';

describe('collectPredicateFieldRefs', () => {
  it('harvests `record.x` references', () => {
    expect(collectPredicateFieldRefs(['record.owner == os.user.id'])).toEqual(['owner']);
  });

  it('harvests the `data.x` spelling too', () => {
    expect(collectPredicateFieldRefs(['data.status == "open"'])).toEqual(['status']);
  });

  it('reads the { dialect, source } envelope', () => {
    expect(
      collectPredicateFieldRefs([{ dialect: 'cel', source: 'record.stage != "won"' }]),
    ).toEqual(['stage']);
  });

  it('harvests every reference in a compound predicate, deduplicated and in order', () => {
    expect(
      collectPredicateFieldRefs([
        'record.owner == os.user.id && record.stage != "won"',
        'record.owner != null',
      ]),
    ).toEqual(['owner', 'stage']);
  });

  it('contributes nothing for a boolean / empty / absent predicate', () => {
    expect(collectPredicateFieldRefs([true, false, '', '   ', null, undefined, 42])).toEqual([]);
  });

  it('does NOT harvest bare identifiers', () => {
    // At predicate scope a bare name is as likely to be `features` / `os` /
    // `user` or a CEL builtin as a field, and nothing here can tell.
    expect(collectPredicateFieldRefs(['features.bulk_ops && today() > start'])).toEqual([]);
  });

  it('is not confused by a field name embedded in a longer path', () => {
    expect(collectPredicateFieldRefs(['record.owner.id == os.user.id'])).toEqual(['owner']);
  });
});

describe('listViewPredicates', () => {
  it('reaches every surface that evaluates a predicate against a row', () => {
    const refs = collectPredicateFieldRefs(
      listViewPredicates({
        conditionalFormatting: [
          { condition: 'record.overdue', style: {} },
          { expression: '${record.priority == "urgent"}' },
          { field: 'health', operator: 'equals', value: 'red' },
        ],
        rowActionDefs: [{ name: 'a', visible: 'record.owner == os.user.id', disabled: 'record.locked' }],
        bulkActionDefs: [{ name: 'b', visible: 'record.done != true' }],
        objectActions: [{ name: 'c', visible: 'record.stage == "review"' }],
        userActions: { edit: { visibleWhen: 'record.editable' }, delete: { disabledWhen: 'record.system' } },
      }),
    );

    expect(refs).toEqual([
      'overdue', 'priority', 'health',
      'owner', 'locked',
      'done',
      'stage',
      'editable', 'system',
    ]);
  });

  it('returns nothing for a view that declares no predicates', () => {
    expect(collectPredicateFieldRefs(listViewPredicates({}))).toEqual([]);
  });

  it('tolerates malformed entries in every list', () => {
    expect(
      collectPredicateFieldRefs(
        listViewPredicates({
          conditionalFormatting: [null, 'nope' as unknown as object],
          rowActionDefs: [undefined],
          bulkActionDefs: [42 as unknown as object],
          userActions: { edit: null },
        }),
      ),
    ).toEqual([]);
  });

  // objectstack#8018 — `recordIdField` is a row key an action READS, so the
  // projection owes it just as it owes a predicate's operands. Without this the
  // action runtime got `undefined` for it and sent a request naming no record.
  it('harvests `recordIdField` from every action list', () => {
    expect(
      collectPredicateFieldRefs(
        listViewPredicates({
          rowActionDefs: [{ name: 'a', recordIdField: 'token' }],
          bulkActionDefs: [{ name: 'b', recordIdField: 'batch_key' }],
          objectActions: [{ name: 'c', recordIdField: 'external_ref' }],
        }),
      ),
    ).toEqual(['token', 'batch_key', 'external_ref']);
  });

  it('harvests a `recordIdField` alongside the same action’s predicates', () => {
    expect(
      collectPredicateFieldRefs(
        listViewPredicates({
          objectActions: [
            { name: 'revoke', visible: 'record.active', recordIdField: 'token' },
          ],
        }),
      ),
    ).toEqual(['active', 'token']);
  });

  it('adds nothing for the default `id` or a non-string declaration', () => {
    expect(
      collectPredicateFieldRefs(
        listViewPredicates({
          objectActions: [
            { name: 'a' },
            { name: 'b', recordIdField: '' },
            { name: 'c', recordIdField: 42 },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('drops a `recordIdField` that is not a bare identifier', () => {
    // Not a field name anywhere, and dropping is the safe direction: an unknown
    // key in `$select` is not ignored by every backend.
    expect(
      collectPredicateFieldRefs(
        listViewPredicates({ objectActions: [{ name: 'a', recordIdField: 'not a field' }] }),
      ),
    ).toEqual([]);
  });
});

describe('isProjectableField', () => {
  const declared = { title: { type: 'text' }, owner: { type: 'user' } };

  it('accepts a field the object declares', () => {
    expect(isProjectableField('owner', declared)).toBe(true);
  });

  it('rejects a name the object does not declare — a typo must not reach $select', () => {
    // Not pedantry: an unknown key is not ignored by every backend (the cloud
    // runtime answers with an empty result set), so one typo could blank a list.
    expect(isProjectableField('ownr', declared)).toBe(false);
  });

  it('accepts the platform columns every object carries but none DECLARES', () => {
    // `record.owner_id == os.user.id` is the commonest ownership gate there is,
    // and `owner_id` is absent from published object metadata.
    for (const c of ['id', 'owner_id', 'organization_id', 'created_by', 'updated_at']) {
      expect(isProjectableField(c, declared)).toBe(true);
    }
  });

  it('rejects the legacy display-set aliases that are columns nowhere', () => {
    for (const alias of ['_id', 'createdAt', 'modified', 'space']) {
      expect(isProjectableField(alias, declared)).toBe(false);
    }
  });

  it('accepts only the platform columns when the schema is unknown', () => {
    expect(isProjectableField('owner_id', null)).toBe(true);
    expect(isProjectableField('title', null)).toBe(false);
  });
});
