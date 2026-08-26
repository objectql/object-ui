// Copyright (c) 2025 ObjectStack. Licensed under the Apache-2.0 license.

/**
 * `FlowDesignerEdge.condition` is the spec's expression envelope — pinned at
 * compile time (objectui#3202).
 *
 * The designer's edge guard used to be typed `string | { source?: string }`,
 * which describes an envelope WITHOUT the ADR-0089 `dialect` discriminant — a
 * shape the server's own `FlowEdgeSchema` rejects, and one nothing in this repo
 * has ever produced. An over-wide read type costs something even when no
 * runtime path exercises it: objectui#3171 was filed as a defect against that
 * phantom envelope, investigated, and does not reproduce. A type that cannot
 * DESCRIBE a spec-rejected condition cannot send the next reader down that road
 * either — which is only true for as long as somebody checks, hence this file.
 *
 * The assertions below are the file's entire point, and what makes them a check
 * rather than commentary is `packages/app-shell/tsconfig.test.json`: it compiles
 * every `src/**\/*.test.ts` in the package, this file included, and is chained
 * off the package's `type-check` script. Without some such project they WOULD be
 * commentary — the package's build tsconfig excludes `**\/*.test.ts`, and vitest
 * erases types before running (objectui#3181 — the same trap
 * `src/__tests__/spec-symbol-parity.test.ts` documents in its header). Coverage
 * is by glob, so this file earns it by living under `src/`, not by appearing on
 * a list; the narrow `tsconfig.typetests.json` that used to name it was retired
 * when the package graduated (objectui#4040). The
 * runtime case at the bottom is real too: it walks an envelope through
 * `conditionText`, the reader every consumer of this type goes through.
 */

import { describe, it, expect } from 'vitest';
import { conditionText, type FlowDesignerEdge } from './flow-canvas-layout';
import type { ExpressionInput } from '@objectstack/spec/shared';

type Assert<T extends true> = T;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

type Condition = NonNullable<FlowDesignerEdge['condition']>;

describe('FlowDesignerEdge.condition mirrors the spec ExpressionInput', () => {
  it('is pinned at compile time', () => {
    // Guard against the probe lying: were either side `any`, every
    // assignability assertion below would pass while proving nothing
    // (objectstack#4171 is exactly that failure mode for other symbols).
    type _SpecNotAny = Assert<Equal<IsAny<ExpressionInput>, false>>;
    type _LocalNotAny = Assert<Equal<IsAny<Condition>, false>>;

    // Not "compatible with" — the SAME type. Restating the envelope locally is
    // how the two drift apart again.
    type _IsExactlyTheSpecType = Assert<Equal<Condition, ExpressionInput>>;

    // The authored shorthand (a bare CEL string) stays authorable…
    type _StringIsACondition = Assert<Extends<string, Condition>>;
    // …and the full envelope with its REQUIRED discriminant.
    type _EnvelopeIsACondition = Assert<Extends<{ dialect: 'cel'; source: string }, Condition>>;

    // The regression itself: a `dialect`-less envelope is no longer expressible.
    // `FlowEdgeSchema` rejects it, so this type must too.
    type _DialectlessRejected = Assert<Equal<Extends<{ source: string }, Condition>, false>>;
    // And `dialect` is closed over the spec's three dialects (`js` was retired
    // in objectstack#3278) — a free-form string is not a dialect.
    type _DialectIsClosed = Assert<Equal<Extends<{ dialect: 'sql'; source: string }, Condition>, false>>;

    expect(true).toBe(true);
  });

  it('reads both spellings at runtime, which is why both must type-check', () => {
    const bare: FlowDesignerEdge = { source: 'a', target: 'b', condition: 'amount > 10' };
    const envelope: FlowDesignerEdge = {
      source: 'a',
      target: 'b',
      condition: { dialect: 'cel', source: 'amount > 10' },
    };
    expect(conditionText(bare.condition)).toBe('amount > 10');
    expect(conditionText(envelope.condition)).toBe('amount > 10');
    // An envelope carrying only a compiled `ast` has no readable source yet
    // (spec phase M9.2) — the reader says so instead of inventing text.
    expect(conditionText({ dialect: 'cel', ast: { op: 'gt' } })).toBeUndefined();
  });
});
