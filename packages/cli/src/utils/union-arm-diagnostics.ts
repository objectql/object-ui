/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Arm selection for a failing union (objectui#7004, arm-selection half).
 *
 * ## What this exists for
 *
 * `safeValidateSchema` runs `AnyComponentSchema`, a `z.union`. When a document
 * matches no arm, Zod 4 reports ONE top-level issue — `invalid_union` · `Invalid
 * input` · `path: []` — and hangs every arm's real diagnosis off that issue's
 * `errors` array. `validate.ts` used to print only the top level, so the author
 * got a bare verdict on the whole document even when the schema had diagnosed
 * the defect precisely, remediation text and all.
 *
 * The 2026-09-02 maintainer ruling chose **B — discriminator-selected arm**:
 * print the issues of the single arm that accepts the authored `type`, and
 * nothing from the others; when no arm accepts it, print a note plus a CAPPED
 * list of the nearest candidate arm names. Printing every arm (option A),
 * picking the arm with the fewest issues (option C) and the status quo (option
 * D) were all rejected.
 *
 * This module performs the SELECTION only. Every `console.*` call stays in
 * `validate.ts`, which remains the repository's only zod-issue printer — so no
 * second rendering surface is created and no shared renderer is warranted.
 *
 * ## Measured facts this rests on (Zod 4.4.3, measured on this tree)
 *
 * 1. `errors` is positionally aligned with the union's options: one entry per
 *    member of `AnyComponentSchema`, `errors[i]` being option `i`'s issues.
 *    Selection here never relies on that alignment — see (2) — but it is why
 *    the arm lists can be read as arms at all.
 * 2. **An arm names the literals it accepts, in its own issues.** Two shapes do
 *    it, and they are the only two:
 *      - `invalid_value` at `['type']`, carrying `values: ['app']` — an object
 *        arm whose `type` is a `z.literal`;
 *      - `invalid_union` at `['type']` with `note: 'No matching discriminator'`,
 *        carrying `options: ['div', 'box', …]` — a `z.discriminatedUnion` arm.
 *    So the accepted-literal set is derivable from the error tree ALONE. This
 *    module therefore never imports or introspects the schema, and cannot drift
 *    from it.
 * 3. **Paths inside `errors` are RELATIVE to their union's node.** The nested
 *    union at `['items', 0]` reports its arm issues at `['type']`, not at
 *    `['items', 0, 'type']`. Printing them raw would name the wrong node, so
 *    every path here is rebased onto its parent's prefix.
 * 4. Every leaf arm of `AnyComponentSchema` carries a DISTINCT `type` literal —
 *    no literal is claimed by two arms — so "exactly one arm accepts that
 *    literal" is total and unambiguous at the document root. Stated as a
 *    property and not as a count on purpose: the number of arms moves every
 *    time a component lands, the distinctness does not, and it is the
 *    distinctness the selection rests on.
 *
 * ## The third branch, and why it is not option A
 *
 * The ruling partitions on "exactly one arm accepts" vs "no arm accepts". Both
 * presuppose arms that DECLARE a `type` contract. Not every union has them:
 * `MenuItemSchema` — the union this card was filed about — is a two-arm
 * `z.union` whose arms both declare `type` as an ADR-0049 retirement tombstone
 * (`z.never()`), so neither names a literal and no discriminator exists to
 * select on. Measured: its arms report `invalid_type` (`expected: 'never'`)
 * with no `values`.
 *
 * Routing that to the "no arm accepts" branch would be literally true and
 * exactly wrong: the candidate list would be empty and the objectui#6523
 * remediation text — the very text this card exists to deliver — would be
 * dropped. So a union with NO declaring arm falls back to the ruling's own
 * named fallback, "A with a cap": every arm reported, capped by
 * {@link MAX_UNION_ARMS_REPORTED}. This is not option A at the root, which the
 * ruling rejected on the arm-count noise argument — the root is always
 * discriminated (fact 4), and undiscriminated unions in this mirror are small
 * (`MenuItemSchema` has two arms).
 */

/**
 * The shape this module reads out of a Zod issue.
 *
 * Structural rather than imported from `zod`: the CLI receives issues across a
 * package boundary and only ever reads them, so a narrow local shape keeps this
 * module honest about exactly which fields the selection depends on.
 */
export interface UnionIssueLike {
  code?: string;
  path?: readonly PropertyKey[];
  message?: string;
  /** Present on `invalid_union`: one entry per arm, positionally aligned. */
  errors?: readonly (readonly UnionIssueLike[])[];
  /** Present on `invalid_value`: the literal values the arm accepts. */
  values?: readonly unknown[];
  /** Present on a discriminated union's `No matching discriminator`. */
  options?: readonly unknown[];
  note?: string;
}

/** One arm issue, rebased onto an absolute path. */
export interface UnionArmIssue {
  kind: 'issue';
  path: PropertyKey[];
  message: string;
  code?: string;
  /**
   * Set only when several arms are reported at once (the undiscriminated
   * fallback), so the reader can tell whose diagnosis is whose. A selected arm
   * needs no label — there is only one.
   */
  arm?: string;
}

/** The "no arm accepts type X" note, with its capped candidate list. */
export interface UnionArmNote {
  kind: 'note';
  path: PropertyKey[];
  /** The authored `type`, or `undefined` when the document carries none. */
  authoredType?: string;
  /**
   * Nearest arm names, already ranked and capped.
   *
   * EMPTY when the document declares no `type` at all. "Nearest" needs
   * something to be near, and an alphabetical slice of the arm names presented
   * under a `type` the author never wrote is a bogus suggestion — the failure
   * `known-type-case-suggestion.ts` refuses by returning `undefined` rather
   * than guessing. The note still fires; it just names the missing `type` key
   * instead of pretending to rank against it.
   */
  candidates: string[];
  /**
   * How many `type` values the union accepts in total. Printed with the
   * candidates so the list reads as "the nearest few of a closed set" rather
   * than as a confident "did you mean" — which matters because a foreign
   * `type` has no near miss at all: measured, `module`'s nearest arm is
   * `toggle` at distance 3.
   */
  totalArmNames: number;
}

export type UnionArmLine = UnionArmIssue | UnionArmNote;

/**
 * The cap the 2026-09-02 ruling requires ("a **capped** list of the nearest
 * candidate arm names — the cap is a named constant, chosen by the implementer
 * and pinned").
 *
 * Five, from a measurement rather than taste. The candidate set is the union's
 * arm names, and the document root carries far more of them than five, so the
 * cap is the whole distance between a hint and the option A the ruling
 * rejected.
 *
 * Ranking those arm names by edit distance against four authored typos gave the
 * same shape every time: the intended arm is rank 1 and ALONE in its distance
 * band (`dropdwn-menu` -> `dropdown-menu` at 1, one name at that distance;
 * `dropdwon-menu` -> `dropdown-menu` at 2, one name; `Page` -> `page` at 1, one
 * name; `obect-grid` -> `object-grid` at 1, one name), and the next band opens
 * 1-6 edits further out holding 1-5 names. So a cap of 5 shows the winner plus
 * the following band entire, and stops well short of the arm count. A cap of 1
 * would print the winner with nothing around it and read as a confident answer
 * rather than as a ranked list — the same over-claim
 * `known-type-case-suggestion.ts` refuses on the sibling surface. Five is also
 * the conventional shell and compiler suggestion size and holds one terminal
 * line at these name lengths.
 *
 * The same number caps the arms reported when a union has no discriminator to
 * select on (see this module's header). Both lists answer the same question —
 * how many arm-shaped things may be printed before the output becomes the noise
 * option A was rejected for — so they share one constant rather than inviting a
 * second magic number to drift from it.
 */
export const MAX_UNION_ARMS_REPORTED = 5;

/** Unit-cost Levenshtein distance (insert / delete / substitute). */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * The nearest arm names to the authored `type`, capped.
 *
 * Unit-cost edit distance, ascending, ties broken lexicographically so the
 * output is deterministic. Chosen because the authored `type` and the arm names
 * are short kebab-case identifiers whose realistic authoring errors are a
 * dropped, added, doubled or mistyped character (`dropdwn-menu`), which is
 * precisely what unit-cost distance ranks nearest; a prefix or case-only match
 * would miss any typo in the first token, and a transposition-aware metric
 * (Damerau) buys a case this tree's arm names do not need — a transposition
 * scores 2 here and still lands at the top of the list.
 *
 * ⚠️ Not to be confused with `known-type-case-suggestion.ts`, which is
 * deliberately case-only under a DIFFERENT ruling (objectui#5247) for a
 * DIFFERENT surface (`objectui check`) over a DIFFERENT candidate set
 * (`KNOWN_SCHEMA_TYPES`, the registry's keys). This surface's candidates are the
 * schema union's arms, and the 2026-09-02 ruling on objectui#7004 asks for the
 * "nearest" ones by name — so proximity is granted here and is not a widening
 * of that one.
 */
export function nearestArmNames(
  authoredType: string | undefined,
  armNames: readonly string[],
): { candidates: string[]; total: number } {
  const unique = [...new Set(armNames)].sort();
  // Nothing to be near: say nothing rather than rank against a `type` the
  // author never wrote. See `UnionArmNote.candidates`.
  if (typeof authoredType !== 'string' || authoredType === '') {
    return { candidates: [], total: unique.length };
  }
  const ordered = [...unique].sort((x, y) => {
    const d = editDistance(authoredType, x) - editDistance(authoredType, y);
    return d !== 0 ? d : x.localeCompare(y);
  });
  return { candidates: ordered.slice(0, MAX_UNION_ARMS_REPORTED), total: unique.length };
}

/** Read `document[...path].type`, when it is a string. */
function authoredTypeAt(document: unknown, path: readonly PropertyKey[]): string | undefined {
  let node: unknown = document;
  for (const key of path) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<PropertyKey, unknown>)[key];
  }
  if (node === null || typeof node !== 'object') return undefined;
  const type = (node as Record<string, unknown>).type;
  return typeof type === 'string' ? type : undefined;
}

function isUnion(issue: UnionIssueLike): boolean {
  return issue.code === 'invalid_union' && Array.isArray(issue.errors);
}

function isAtTypeKey(issue: UnionIssueLike): boolean {
  const path = issue.path ?? [];
  return path.length === 1 && path[0] === 'type';
}

/**
 * The `type` literals an arm declares it accepts, or `undefined` when the arm
 * declares no `type` contract at all.
 *
 * `undefined` and `[]` are different answers and the caller depends on the
 * difference: `undefined` means "this arm has no discriminator" (an ADR-0049
 * tombstone arm, or one that simply never mentions `type`), which is what sends
 * a union to the undiscriminated fallback instead of to "no arm accepts".
 */
function declaredTypeLiterals(armIssues: readonly UnionIssueLike[]): string[] | undefined {
  const literals: string[] = [];
  let declares = false;
  for (const issue of armIssues) {
    if (isAtTypeKey(issue) && issue.code === 'invalid_value' && Array.isArray(issue.values)) {
      declares = true;
      literals.push(...issue.values.filter((v): v is string => typeof v === 'string'));
      continue;
    }
    if (isAtTypeKey(issue) && isUnion(issue) && Array.isArray(issue.options)) {
      declares = true;
      literals.push(...issue.options.filter((v): v is string => typeof v === 'string'));
      continue;
    }
    // A nested union at the arm's own node (a `z.union` member that is itself a
    // union, e.g. `ObjectQLComponentSchema`): it declares a contract only if
    // every one of ITS arms does, and its literals are their union.
    if ((issue.path ?? []).length === 0 && isUnion(issue)) {
      const nested = (issue.errors ?? []).map((sub) => declaredTypeLiterals(sub));
      if (nested.length > 0 && nested.every((n) => n !== undefined)) {
        declares = true;
        for (const n of nested) literals.push(...(n as string[]));
      }
    }
  }
  return declares ? literals : undefined;
}

/**
 * Recursion terminates by construction: every call descends one level into
 * `issue.errors`, which Zod materialises eagerly as plain nested arrays at parse
 * time — a finite tree with no lazy getters and therefore no cycle, even for a
 * `z.lazy` schema like `MenuItemSchema` (the laziness is in the SCHEMA, not in
 * the issue tree it produces). Measured max depth on this tree: 3.
 */
function explain(
  unionIssue: UnionIssueLike,
  prefix: readonly PropertyKey[],
  document: unknown,
): UnionArmLine[] {
  const arms = unionIssue.errors ?? [];
  const declared = arms.map((arm) => declaredTypeLiterals(arm));
  const declaringArms = declared.filter((d) => d !== undefined) as string[][];
  const acceptingIndexes = declared
    .map((d, i) => (d === undefined ? i : -1))
    .filter((i) => i >= 0);

  const expand = (armIssues: readonly UnionIssueLike[], arm?: string): UnionArmLine[] =>
    armIssues.flatMap((issue) => {
      const absolute = [...prefix, ...(issue.path ?? [])];
      if (isUnion(issue)) return explain(issue, absolute, document);
      return [
        {
          kind: 'issue' as const,
          path: absolute,
          message: issue.message ?? '',
          code: issue.code,
          ...(arm === undefined ? {} : { arm }),
        },
      ];
    });

  // B — exactly one arm accepts the authored literal. Print its issues, and
  // nothing from the others.
  if (declaringArms.length > 0 && acceptingIndexes.length === 1) {
    return expand(arms[acceptingIndexes[0]]);
  }

  // B's other half — the union IS discriminated and no arm accepts.
  if (declaringArms.length > 0 && acceptingIndexes.length === 0) {
    const authoredType = authoredTypeAt(document, prefix);
    const { candidates, total } = nearestArmNames(authoredType, declaringArms.flat());
    return [
      {
        kind: 'note',
        path: [...prefix],
        ...(authoredType === undefined ? {} : { authoredType }),
        candidates,
        totalArmNames: total,
      },
    ];
  }

  // No discriminator to select on (or, defensively, more than one accepting
  // arm): the ruling's named fallback, every arm capped.
  return arms
    .slice(0, MAX_UNION_ARMS_REPORTED)
    .flatMap((arm, i) => expand(arm, `${i + 1}/${arms.length}`));
}

/**
 * The lines to print beneath a top-level `invalid_union` entry.
 *
 * Returns `[]` for any issue that is not a union with arm errors, so the caller
 * can call it unconditionally.
 */
export function explainUnionIssue(issue: UnionIssueLike, document: unknown): UnionArmLine[] {
  if (!isUnion(issue)) return [];
  return explain(issue, issue.path ?? [], document);
}
