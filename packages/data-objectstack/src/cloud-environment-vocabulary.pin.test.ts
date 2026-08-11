/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * `CloudDeploymentConfig.environment` — deploy-target vocabulary pin
 * (objectui#3720).
 *
 * The card recorded a third hand-written environment spelling sitting beside
 * the two enums `@objectstack/spec` declares, and left the disposition open:
 * converge onto a spec enum, or declare the divergence deliberate. The
 * measurement decided it — there is no producer-side deploy-target type to
 * converge ONTO. As of `@objectstack/client@17.0.0-rc.5` the client exports no
 * `cloud` namespace at all, so `CloudOperations.deploy` optional-chains into
 * `undefined`; nothing on the wire has ever accepted or rejected one of these
 * values. Importing `EnvironmentType` instead would assert a subset
 * relationship no producer confirms.
 *
 * So the list stays local and the deliberateness is written down — and this
 * file is what stops "written down" from decaying into "stale". It pins the
 * three facts a reader of that comment is entitled to trust:
 *
 *   1. the union really is those three members (compile time AND source text),
 *   2. the comment really does still name both spec enums and the trap,
 *   3. the spec-side facts the comment asserts are still true of the INSTALLED
 *      spec — the member lists, and `staging` being outside the discovery
 *      vocabulary.
 *
 * ## Why (1) is pinned twice
 *
 * The compile-time `Equal` pin catches a changed union; it cannot catch a
 * changed union whose comment was left behind, because a comment is invisible
 * to the checker. The source-text pin reads both out of the same file, so
 * adding a member without touching the note goes red on the pair. Neither pin
 * alone closes it — that is the "anchor on both" the card's dispatch asked for.
 *
 * ## Why the source is read through `ts.sys` rather than `node:fs`
 *
 * Same reason `spec-symbol-batch6.test.ts` gives: this package's `tsconfig.json`
 * compiles its whole test tree, so keeping `@types/node` out of a browser-side
 * adapter's type environment is deliberate. TypeScript's own system host is
 * typed by the `typescript` devDependency this file already needs.
 *
 * ## When (3) goes red
 *
 * A spec bump moved an environment enum. That is not a reason to edit the
 * expected list until the comment above `environment` has been re-read: this is
 * exactly the drift breakpoint objectui#3720 asked to be alarmed on. If
 * `staging` ever becomes a `DiscoveryEnvironment` member, the trap the comment
 * warns about has been resolved upstream and the note must be rewritten, not
 * the assertion relaxed.
 */

import { describe, it, expect } from 'vitest';
import ts from 'typescript';

import { DiscoveryEnvironmentSchema } from '@objectstack/spec/api';
import { EnvironmentTypeSchema } from '@objectstack/spec/cloud';

import type { CloudDeploymentConfig } from './cloud';

/** The deploy targets this package declares, in declaration order. */
const DEPLOY_TARGETS = ['development', 'staging', 'production'] as const;

/** This file, as an absolute path — `cloud.ts` is its sibling. */
const HERE = new URL(import.meta.url).pathname;
const CLOUD_TS = HERE.replace(/[^/]+$/, 'cloud.ts');

function cloudSource(): string {
  const raw = ts.sys.readFile(CLOUD_TS);
  if (!raw) throw new Error(`cannot read ${CLOUD_TS}`);
  return raw;
}

const CLOUD_SOURCE = cloudSource();

/** The `environment: …;` member declaration, matched off the interface body. */
const DECLARATION_MATCH = /\n[ \t]*environment:[ \t]*([^;\n]+);/.exec(CLOUD_SOURCE);

/**
 * The doc block attached to that declaration — i.e. the last one closing before
 * it. Deleting the note does not make this return nothing; it makes it return
 * whatever block is now nearest, which will not carry the tokens below. Either
 * way the comment assertions go red, which is the point.
 */
function environmentDocBlock(): string {
  if (!DECLARATION_MATCH) return '';
  const before = CLOUD_SOURCE.slice(0, DECLARATION_MATCH.index);
  const open = before.lastIndexOf('/**');
  const close = before.lastIndexOf('*/');
  if (open < 0 || close < open) return '';
  return before.slice(open, close + 2);
}

describe('the source probe itself works', () => {
  it('found the `environment` member declaration in cloud.ts', () => {
    expect(
      DECLARATION_MATCH,
      `cannot find an \`environment:\` member in ${CLOUD_TS}. If the field was ` +
        `renamed or moved, every pin in this file is now vacuous — re-point it ` +
        `rather than deleting it.`,
    ).not.toBeNull();
  });

  it('found a doc block attached to it', () => {
    expect(environmentDocBlock().length).toBeGreaterThan(200);
  });
});

describe('the deploy-target union stays exactly three members', () => {
  it('is what the source text declares', () => {
    const spelled = (DECLARATION_MATCH?.[1] ?? '')
      .split('|')
      .map((part) => part.trim().replace(/^'|'$/g, ''));

    expect(
      spelled,
      `\`CloudDeploymentConfig.environment\` changed members. This union is a ` +
        `DELIBERATE third vocabulary (objectui#3720) and its doc comment states ` +
        `exactly which members it has — change one and the other is now a lie. ` +
        `Update the comment above the field and this list together, or converge ` +
        `onto a real producer type if one has finally landed.`,
    ).toEqual([...DEPLOY_TARGETS]);
  });

  it('is what the type declares', () => {
    // Compile-time half of the same pin: `Equal` rather than `extends`, so a
    // widening to `string` fails too.
    type Assert<T extends true> = T;
    type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
      ? true
      : false;

    type _ExactlyTheThreeTargets = Assert<
      Equal<CloudDeploymentConfig['environment'], (typeof DEPLOY_TARGETS)[number]>
    >;
    type _NotWidenedToString = Assert<Equal<Equal<CloudDeploymentConfig['environment'], string>, false>>;

    expect(true).toBe(true);
  });
});

describe('the note that makes the divergence deliberate is still there', () => {
  const REQUIRED_TOKENS: Array<[token: string, why: string]> = [
    ['objectui#3720', 'the card that ruled this list a deliberate island'],
    ['EnvironmentType', "spec's 7-member environment-registry taxonomy"],
    ['DiscoveryEnvironment', "spec's 3-member discovery-posture enum"],
    ['sandbox', 'the discovery member `staging` is NOT, and folds onto'],
    ['@objectstack/client', 'the producer that would own a deploy-target type, and does not exist yet'],
  ];

  it.each(REQUIRED_TOKENS)('names `%s` (%s)', (token) => {
    expect(
      environmentDocBlock().includes(token),
      `the doc comment on \`CloudDeploymentConfig.environment\` no longer mentions ` +
        `\`${token}\`. That comment is the entire deliverable of objectui#3720: ` +
        `without it this union is indistinguishable from the accidental third ` +
        `spelling the card filed. Restore the reasoning, do not delete the pin.`,
    ).toBe(true);
  });
});

describe("the spec-side facts the comment asserts are still true of the installed spec", () => {
  it('DiscoveryEnvironment is still the three coarse postures', () => {
    expect(
      [...DiscoveryEnvironmentSchema.options],
      `@objectstack/spec's \`DiscoveryEnvironmentSchema\` moved. Re-read the ` +
        `comment on \`CloudDeploymentConfig.environment\` before touching this ` +
        `expectation — objectui#3720 named this the drift breakpoint.`,
    ).toEqual(['production', 'sandbox', 'development']);
  });

  it('EnvironmentType is still the seven-member registry taxonomy', () => {
    expect(
      [...EnvironmentTypeSchema.options],
      `@objectstack/spec's \`EnvironmentTypeSchema\` moved. The comment on ` +
        `\`CloudDeploymentConfig.environment\` quotes this member list verbatim; ` +
        `update both together.`,
    ).toEqual(['production', 'sandbox', 'development', 'test', 'staging', 'preview', 'trial']);
  });

  it('`staging` is rejected by the discovery vocabulary — the trap the comment warns about', () => {
    expect(
      DiscoveryEnvironmentSchema.safeParse('staging').success,
      `\`staging\` is now accepted by \`DiscoveryEnvironmentSchema\`. The trap the ` +
        `comment warns about (a deploy target must not be copied onto a discovery ` +
        `response) has changed shape — rewrite the note rather than relaxing this.`,
    ).toBe(false);
  });

  it('every deploy target is nonetheless a valid EnvironmentType member', () => {
    // Not a derivation and not a mapping — a recorded fact. The day it stops
    // being true, the comment's table is wrong.
    for (const target of DEPLOY_TARGETS) {
      expect(EnvironmentTypeSchema.safeParse(target).success, `EnvironmentType lost \`${target}\``).toBe(
        true,
      );
    }
  });
});
