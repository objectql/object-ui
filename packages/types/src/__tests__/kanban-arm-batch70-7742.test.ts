/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * The `'kanban'` arm's accept set after decision batch #70 (objectui#7742,
 * ADR-0049, maintainer 2026-09-07: 「同意」).
 *
 * ## Why this file exists next to `kanban-plugin-dialect-authoritative-7664`
 *
 * That file pins the arm's declared BODY — which members exist, live or
 * tombstoned — with a TypeScript AST census. This one pins what a DOCUMENT gets
 * back, through `safeValidateSchema` itself. The two are not interchangeable:
 * `BaseSchema` is `.passthrough()`, so a key can be absent from the shape and
 * still parse green, and a key can be present in the shape as a refusal arm and
 * make a document fail. Only a parse answers the accept-set question.
 *
 * ## The unusual thing about this card, stated so a reader checks both halves
 *
 * The accept set moves in BOTH directions in one change, which is why the PR
 * carries `needs:contract-review`:
 *
 *   - NARROWER — `allowCollapse`, `cardTemplates`, `columnWidths` and
 *     `titleField` were accepted and are now refused BY NAME.
 *   - WIDER — `navigation` was undeclared (admitted through `BaseSchema`'s
 *     index signature, never examined) and is now declared and JUDGED.
 *
 * A file that only checked the narrowing would pass on a change that forgot the
 * widening entirely, and the reverse. Both directions are asserted here.
 *
 * ## Every refusal is paired with a CONTROL that fires the other way
 *
 * A `.passthrough()` object accepts an unknown key. So "the document failed"
 * proves nothing on its own — it has to be shown that an ARBITRARY key does
 * NOT fail on the same call, or the refusal could just be strictness that
 * arrived some other way. Each refusal assertion below therefore runs against a
 * document that also carries a bogus key, and asserts the bogus key draws NO
 * issue while the retired key draws one at its own path.
 */

import { describe, it, expect } from 'vitest';
import { safeValidateSchema } from '../zod/index.zod';

/** Zod 4 nests a failing `z.union` arm's issues under `invalid_union.errors`. */
type IssueLike = { path: PropertyKey[]; message: string; errors?: IssueLike[][] };
function flattenIssues(issues: IssueLike[]): Array<{ path: string; message: string }> {
  return issues.flatMap((i) =>
    i.errors
      ? i.errors.flat().flatMap((nested) => flattenIssues([nested]))
      : [{ path: i.path.join('.'), message: i.message }],
  );
}
function refusals(schema: unknown): Array<{ path: string; message: string }> {
  const r = safeValidateSchema(schema);
  return r.success ? [] : flattenIssues(r.error.issues as unknown as IssueLike[]);
}

/** A board that validates today, used as the base every probe is added to. */
const LIVE_BOARD = {
  type: 'kanban',
  objectName: 'tasks',
  groupBy: 'status',
  cardTitle: 'title',
} as const;

/**
 * The key a control uses. It must be a name no arm of the union declares, so a
 * `.passthrough()` accept is the only correct answer for it.
 */
const BOGUS = 'thisKeyIsDeclaredByNoArm';

/** The four keys batch #70 retired from this arm, with what each points at. */
const RETIRED = [
  { key: 'allowCollapse', value: true, remedyMentions: 'collapsed' },
  { key: 'cardTemplates', value: [{ id: 't', name: 'Bug', values: {} }], remedyMentions: 'COMPONENT PROP' },
  { key: 'columnWidths', value: { defaultWidth: 280 }, remedyMentions: 'HOOK OPTION' },
  { key: 'titleField', value: 'name', remedyMentions: 'cardTitle' },
] as const;

describe('batch #70 NARROWS the `kanban` arm — four keys are refused by name (objectui#7742)', () => {
  for (const { key, value, remedyMentions } of RETIRED) {
    it(`refuses \`${key}\` at its own path, while an undeclared key on the same call is accepted`, () => {
      const found = refusals({ ...LIVE_BOARD, [key]: value, [BOGUS]: 'anything' });

      // The retired key draws an issue AT ITS OWN PATH — so the author reads
      // which key is wrong, not just that the document is.
      const atKey = found.filter((f) => f.path === key);
      expect(atKey, `no refusal at \`${key}\`: ${JSON.stringify(found)}`).not.toEqual([]);

      // THE CONTROL, on the same parse: an arbitrary undeclared key draws
      // nothing. Without this the assertion above would also pass under a
      // validator that had simply become strict.
      expect(
        found.filter((f) => f.path === BOGUS),
        'the control key drew an issue — this arm is not passthrough any more, so the refusal above is not a NAMED one',
      ).toEqual([]);

      // The message carries the remedy, not just a type complaint. This is what
      // `retirementTombstone` exists for: zod's own text would read "expected
      // never, received string" and tell the author nothing.
      expect(
        atKey.map((f) => f.message).join('\n'),
        `\`${key}\`'s refusal does not name its remedy`,
      ).toContain(remedyMentions);
    });
  }

  it('the same four keys were ACCEPTED before this card — the base board without them still passes', () => {
    // The other half of a narrowing claim: the narrowing is the KEY, not the
    // board. A board that never named them is untouched.
    expect(refusals(LIVE_BOARD)).toEqual([]);
  });

  it('`cardTitle` — the spelling `titleField`\'s refusal points at — still validates', () => {
    expect(refusals({ type: 'kanban', objectName: 'tasks', cardTitle: 'name' })).toEqual([]);
  });
});

describe('the SIBLING `object-kanban` arm keeps `titleField` (objectui#7322 item ②, PR #8153)', () => {
  it('accepts a `titleField` document, so the retirement is arm-scoped and not global', () => {
    // ⛔ This is the assertion that makes the `titleField` row a RETIREMENT OF A
    // SPELLING rather than a removal of a capability. `ObjectKanban` renders
    // both node types and still reads the key; only the `kanban` arm stops
    // accepting it.
    expect(refusals({ type: 'object-kanban', objectName: 'tasks', groupBy: 'status', titleField: 'name' })).toEqual([]);
  });

  it('and the `kanban` arm refuses the same key on the same call shape — the two answers differ', () => {
    // The pair is the point: identical documents but for `type`, opposite
    // verdicts. Asserted together so neither can drift without the other.
    // (`groupBy` is on both because the `object-kanban` arm REQUIRES it — a
    // control that fired on the first cut of this file and is kept here as the
    // reason the two probes are spelled the way they are.)
    expect(refusals({ type: 'kanban', objectName: 'tasks', groupBy: 'status', titleField: 'name' })).not.toEqual([]);
  });
});

describe('batch #70 WIDENS the `kanban` arm — `navigation` is declared (objectui#7742, gantt precedent objectui#5903)', () => {
  it('accepts a declared `navigation` config', () => {
    expect(refusals({ ...LIVE_BOARD, navigation: { mode: 'drawer' } })).toEqual([]);
    expect(refusals({ ...LIVE_BOARD, navigation: { mode: 'page' } })).toEqual([]);
  });

  it('JUDGES the value, not just the key — a bad `mode` is refused inside `navigation`', () => {
    // ⭐ The verdict that separates "declared" from "admitted". Before this card
    // `navigation` rode `BaseSchema`'s `[key: string]: any`, so ANY value passed
    // — including this one. A test that only asserted the good config would
    // have passed on `origin/main` too and pinned nothing.
    const found = refusals({ ...LIVE_BOARD, navigation: { mode: 'not-a-mode' } });
    expect(found, 'an invalid navigation mode was accepted — the key is admitted, not judged').not.toEqual([]);
    expect(
      found.some((f) => f.path.startsWith('navigation')),
      `no issue under \`navigation\`: ${JSON.stringify(found)}`,
    ).toBe(true);
  });

  it('and the member list is the spec\'s — a key the spec does not declare is refused inside `navigation`', () => {
    // The vocabulary is `@objectstack/spec`'s `NavigationConfig` BY REFERENCE,
    // not restated here, so it cannot fork. `basePath` is the name the package
    // README once showed and the spec never declared.
    const found = refusals({ ...LIVE_BOARD, navigation: { mode: 'drawer', basePath: '/tasks' } });
    expect(found, 'an undeclared navigation member was accepted').not.toEqual([]);
  });
});
