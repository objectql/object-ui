/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * objectui#4528 — COMPILE-TIME pins on the props a `ListView` JSX call site is
 * actually held to.
 *
 * These assertions are erased at runtime; `tsc` is the only thing that can
 * check them, which is why this file is carried by
 * `packages/plugin-list/tsconfig.test.json` and why the `expect` below is
 * deliberately trivial — the real assertions are the `Assert< Equal< … > >`
 * types, and a violation is a compile error, not a red test.
 *
 * ## What was measured before the fix
 *
 * The card objectui#4528 asserted this package's shape BY INSPECTION rather
 * than by measurement. It was then measured, on the pre-fix source, compiled
 * through this same project — and matched the sibling package exactly:
 *
 *     keyof React.ComponentProps< typeof ListView >   ->  string | number
 *     React.ComponentProps< typeof ListView >['onRowClick']  ->  any
 *     ListViewProps['onRowClick']  ->  ((record: Record< string, unknown >) => void) | undefined
 *
 * `ListViewProps` carried a `[key: string]: any`, which puts `string` into
 * `keyof Props`, so React's `PropsWithoutRef` took its `Omit` branch and `Omit`
 * over a string index signature keeps ONLY the index signature. The interface
 * declared the contract and no consumer was held to it. The pins below are
 * exactly those reads, in their fixed direction.
 */

import { describe, it, expect } from 'vitest';
import type { ComponentProps } from 'react';
import { ListView, type ListViewProps } from '../ListView';

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;

/** The props a JSX call site is held to. */
type CallSiteProps = ComponentProps<typeof ListView>;

// 1. The declared callback survives to the call site with its REAL signature.
//    Before the fix this was `any`, so a wrong-typed handler — and any prop
//    typo next to it — passed silently.
type _OnRowClickIsDeclared = Assert<
  Equal<CallSiteProps['onRowClick'], ((record: Record<string, unknown>) => void) | undefined>
>;

// 2. …and that is not vacuously true because the whole thing is `any`.
type _OnRowClickIsNotAny = Assert<Equal<IsAny<CallSiteProps['onRowClick']>, false>>;

// 3. The call-site type and the DECLARED interface agree key for key, once the
//    `ref` / `key` that `RefAttributes` contributes are set aside.
type _DeclaredKeysAgree = Assert<
  Equal<Exclude<keyof CallSiteProps, 'ref' | 'key'>, keyof ListViewProps>
>;

// 4. `keyof` is a union of literal keys, NOT the erased `string | number`. THIS
//    is the assertion that discriminates: on the pre-fix shape
//    `keyof CallSiteProps` was `string | number`, so `string` extended it and
//    this pin was `true` — measured, and it is the whole defect in one line.
//    (Note assertion 3 alone would NOT have caught it: pre-fix BOTH sides were
//    erased to `string | number`, so they agreed with each other while agreeing
//    with nothing the interface declared.)
type _KeysAreNotWidened = Assert<Equal<string extends keyof CallSiteProps ? true : false, false>>;

// 5. Named props the interface declares are reachable and correctly typed.
type _SchemaSurvives = Assert<Equal<CallSiteProps['schema'], ListViewProps['schema']>>;
type _ShowViewSwitcherSurvives = Assert<Equal<CallSiteProps['showViewSwitcher'], boolean | undefined>>;
type _InitialSearchTermSurvives = Assert<Equal<CallSiteProps['initialSearchTerm'], string | undefined>>;

// 6. The props this component READS off its rest object are declared by name
//    rather than reachable only through an index signature (objectui#4528).
type _OnAddRecordIsDeclared = Assert<Equal<CallSiteProps['onAddRecord'], (() => void) | undefined>>;
type _OnPageSizeChangeIsDeclared = Assert<
  Equal<CallSiteProps['onPageSizeChange'], ((pageSize: number) => void) | undefined>
>;
type _DataSourceIsDeclared = Assert<'dataSource' extends keyof ListViewProps ? true : false>;

// 7. The row affordances forwarded to the active view component are declared
//    with the signatures `ObjectGrid` receives them at.
type _OnEditIsDeclared = Assert<Equal<CallSiteProps['onEdit'], ((record: any) => void) | undefined>>;
type _OnBulkDeleteIsDeclared = Assert<
  Equal<CallSiteProps['onBulkDelete'], ((records: any[]) => void) | undefined>
>;

describe('objectui#4528 — ListView serves its declared props', () => {
  it('pins the resolved call-site props at compile time', () => {
    // The assertions are the types above; this body only keeps the file a test.
    const probe: CallSiteProps['onRowClick'] = (record: Record<string, unknown>) => {
      void record;
    };
    expect(typeof probe).toBe('function');
  });
});
