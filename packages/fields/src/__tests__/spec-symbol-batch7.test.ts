/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `@object-ui/fields` ↔ `@objectstack/spec` symbol-collision guards
 * (objectui#3161, objectstack#4115 ledger batch 7).
 *
 * Two symbols, two different verdicts:
 *
 *  - `isFileIdToken` was a character-for-character copy of the spec's function
 *    under the spec's own name. It is a re-export now, and the gate below is
 *    REFERENCE IDENTITY — not behaviour. A faithful copy passes every behaviour
 *    test ever written for it (objectui#3003, re-proved on
 *    `isAggregatedViewContainer` in objectui#3169), so `toBe` is the only
 *    assertion that can tell a re-export from a fork.
 *
 *  - `FieldWidgetProps` is now `FieldWidgetComponentProps`. The spec owns that
 *    name for the DECLARED widget-plugin props contract; this package's is the
 *    React interface its widgets implement. The pins record the divergence that
 *    made re-exporting impossible, and the index signature that made the
 *    divergence invisible.
 *
 * The other direction — "the spec must not start owning the NEW names" — is not
 * asserted here because `scripts/check-spec-symbol-derivation.mjs` already
 * answers it on every CI run, for every name in the package rather than the
 * handful a test would remember to list.
 */

import { describe, it, expect } from 'vitest';
import { isFileIdToken as specIsFileIdToken } from '@objectstack/spec/data';
import type { FieldWidgetProps as SpecFieldWidgetProps } from '@objectstack/spec/ui';

import { isFileIdToken, fileIdOf } from '../widgets/file-value';
import type { FieldWidgetComponentProps } from '../widgets/types';

describe('isFileIdToken IS the spec function', () => {
  it('is the same function object, not an equivalent one', () => {
    // The whole point. Every value/behaviour assertion below this line would
    // also pass against a re-forked copy; this one would not.
    expect(isFileIdToken).toBe(specIsFileIdToken);
  });

  it('is the arbiter the rest of the module routes through', () => {
    // `fileIdOf` must keep agreeing with the shared predicate, so a future
    // "small local tweak" to the id shape cannot be reintroduced one caller at
    // a time.
    for (const value of ['abc123', 'AbC-_9', 'x'.repeat(64)]) {
      expect(specIsFileIdToken(value)).toBe(true);
      expect(fileIdOf(value)).toBe(value);
    }
    for (const value of ['https://example.com/f.png', '/api/v1/storage/files/1', 'a.b', 'x'.repeat(65)]) {
      expect(specIsFileIdToken(value)).toBe(false);
      expect(fileIdOf(value)).toBeUndefined();
    }
  });
});

/* -------------------------------------------------------------------------- */
/* Compile-time pins. A violation is a `tsc` error, not a runtime failure.     */
/* This package's tsconfig.json includes its tests, so `type-check` compiles   */
/* them (scripts/check-type-check-coverage.mjs keeps that true).              */
/* -------------------------------------------------------------------------- */

type Assert<T extends true> = T;
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Extends<A, B> = [A] extends [B] ? true : false;
type IsAny<T> = 0 extends 1 & T ? true : false;
type HasKey<T, K extends string> = K extends keyof T ? true : false;

describe('FieldWidgetComponentProps is the RENDERED layer of the spec contract', () => {
  it('is pinned at compile time', () => {
    // The import above is itself half the tripwire: the day the spec stops
    // exporting `FieldWidgetProps`, this file stops compiling and the rename's
    // reason is up for re-triage (the plain name could come back).
    type _SpecIsReal = Assert<Equal<IsAny<SpecFieldWidgetProps>, false>>;

    // The divergence that makes a re-export impossible AND is a live defect
    // worth naming: the declared contract calls the validation-message slot
    // `error`; every widget in this package reads `errorMessage`. A widget
    // written against the spec's declared props renders no message here, and
    // nothing reports it. Recorded, not fixed, by the rename — objectui#3222.
    type _SpecNamesItError = Assert<HasKey<SpecFieldWidgetProps, 'error'>>;
    type _LocalNamesItErrorMessage = Assert<HasKey<FieldWidgetComponentProps, 'errorMessage'>>;

    // …and the reason nobody noticed. The index signature answers `any` for
    // every key this type does not declare, so BOTH of the spec's keys already
    // "exist" here — `props.required` and `props.error` are legal reads that
    // give `any` and are always `undefined` at runtime. No compiler check and
    // no structural comparison can report a key as missing from a type that
    // claims to have every key (objectstack#4075). That is what makes a parity
    // test useless for this symbol and the guard the only detector.
    //
    // These three assertions exist to be DELETED by objectui#3221, which
    // removes the index signature; when that lands they go red on purpose.
    type _IndexSignatureStillThere = Assert<Extends<string, keyof FieldWidgetComponentProps>>;
    type _RequiredSilentlyReadsAsAny = Assert<IsAny<FieldWidgetComponentProps['required']>>;
    type _ErrorSilentlyReadsAsAny = Assert<IsAny<FieldWidgetComponentProps['error']>>;

    expect(true).toBe(true);
  });
});
